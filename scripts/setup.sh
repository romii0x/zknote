#!/bin/bash

# zknote AWS Setup Script
# This script helps set up the initial AWS infrastructure for zknote

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install it first."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Create S3 bucket for Terraform state
create_s3_bucket() {
    local bucket_name="zknote-terraform-state"
    local region=$(aws configure get region)
    
    print_status "Creating S3 bucket for Terraform state..."
    
    if aws s3 ls "s3://$bucket_name" 2>&1 > /dev/null; then
        print_warning "S3 bucket $bucket_name already exists."
    else
        aws s3 mb "s3://$bucket_name" --region "$region"
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled
        print_success "S3 bucket $bucket_name created successfully!"
    fi
}

# Create IAM user for CI/CD
create_iam_user() {
    local user_name="zknote-deploy"
    
    print_status "Creating IAM user for CI/CD..."
    
    if aws iam get-user --user-name "$user_name" &> /dev/null; then
        print_warning "IAM user $user_name already exists."
    else
        aws iam create-user --user-name "$user_name"
        
        # Attach necessary policies
        aws iam attach-user-policy \
            --user-name "$user_name" \
            --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
        
        aws iam attach-user-policy \
            --user-name "$user_name" \
            --policy-arn arn:aws:iam::aws:policy/AmazonECS-FullAccess
        
        aws iam attach-user-policy \
            --user-name "$user_name" \
            --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
        
        print_success "IAM user $user_name created successfully!"
    fi
    
    # Create access keys
    print_status "Creating access keys for IAM user..."
    local keys=$(aws iam create-access-key --user-name "$user_name" --query 'AccessKey' --output json)
    
    echo ""
    print_success "IAM Access Keys created!"
    echo "Please add these to your GitHub repository secrets:"
    echo ""
    echo "AWS_ACCESS_KEY_ID: $(echo "$keys" | jq -r '.AccessKeyId')"
    echo "AWS_SECRET_ACCESS_KEY: $(echo "$keys" | jq -r '.SecretAccessKey')"
    echo ""
    print_warning "Store these securely and add them to GitHub Secrets!"
}

# Setup Terraform
setup_terraform() {
    print_status "Setting up Terraform configuration..."
    
    if [ ! -d "infrastructure/terraform" ]; then
        print_error "Terraform directory not found. Please run this script from the project root."
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Copy example variables file
    if [ ! -f "terraform.tfvars" ]; then
        cp terraform.tfvars.example terraform.tfvars
        print_warning "Please edit terraform.tfvars with your configuration values."
    fi
    
    # Initialize Terraform
    print_status "Initializing Terraform..."
    terraform init
    
    print_success "Terraform setup complete!"
    print_warning "Please edit terraform.tfvars before running 'terraform plan'"
}

# Main execution
main() {
    echo "zknote AWS Setup Script"
    echo "=========================="
    echo ""
    
    check_prerequisites
    create_s3_bucket
    create_iam_user
    setup_terraform
    
    echo ""
    echo "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit infrastructure/terraform/terraform.tfvars with your values"
    echo "2. Add AWS credentials to GitHub repository secrets"
    echo "3. Run 'cd infrastructure/terraform && terraform plan'"
    echo "4. Run 'terraform apply' to deploy infrastructure"
    echo "5. Push to main branch to trigger CI/CD deployment"
    echo ""
}

# Run main function
main "$@" 