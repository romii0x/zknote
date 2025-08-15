# zknote AWS Deployment

This guide will walk you through deploying zknote to AWS using ECS, RDS, and a complete CI/CD pipeline, the same way I have deployed it.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform installed (v1.0+)
- Docker installed
- GitHub repository with the code

## Architecture Overview

```
GitHub → GitHub Actions → ECR → ECS Fargate → ALB → RDS PostgreSQL
```

## Step 1: Initial AWS Setup

### 1.1 Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://zknote-terraform-state
aws s3api put-bucket-versioning --bucket zknote-terraform-state --versioning-configuration Status=Enabled
```

### 1.2 Create IAM User for CI/CD

```bash
# Create IAM user
aws iam create-user --user-name zknote-deploy

# Create access keys
aws iam create-access-key --user-name zknote-deploy

# Attach necessary policies
aws iam attach-user-policy --user-name zknote-deploy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
aws iam attach-user-policy --user-name zknote-deploy --policy-arn arn:aws:iam::aws:policy/AmazonECS-FullAccess
aws iam attach-user-policy --user-name zknote-deploy --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
```

## Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `AWS_ACCESS_KEY_ID`: The access key from the IAM user
- `AWS_SECRET_ACCESS_KEY`: The secret key from the IAM user

## Step 3: Deploy Infrastructure

### 3.1 Configure Terraform Variables

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
aws_region = "us-east-1"
environment = "production"
db_password = "your-secure-database-password-here"
domain_name = "your-domain.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

### 3.2 Initialize and Deploy

```bash
terraform init
terraform plan
terraform apply
```

This will create:
- VPC with public/private subnets
- RDS PostgreSQL instance
- ECS cluster with Fargate
- Application Load Balancer
- ECR repository
- All necessary security groups and IAM roles

## Step 4: Deploy Application

### 4.1 Push to Main Branch

The GitHub Actions workflow will automatically:
1. Run tests and type checking
2. Build Docker image
3. Push to ECR
4. Deploy to ECS

### 4.2 Monitor Deployment

Check the GitHub Actions tab to monitor the deployment progress.

## Step 5: Verify Deployment

### 5.1 Get the Load Balancer URL

```bash
terraform output alb_dns_name
```

### 5.2 Test the Application

Visit the ALB URL and test:
- Creating a note
- Sharing the note
- Decrypting the note
- Note expiration

## Step 6: Custom Domain

### 6.1 Request SSL Certificate

```bash
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --region us-east-1
```

### 6.2 Update Terraform

Add the certificate ARN to `terraform.tfvars` and update the ALB listener to use HTTPS.

## Monitoring and Maintenance

### Logs

View application logs in CloudWatch:
```bash
aws logs describe-log-groups --log-group-name-prefix "/ecs/zknote"
```

### Scaling

The ECS service is configured with 2 desired tasks. You can horizontally scale by updating the service:
```bash
aws ecs update-service --cluster zknote-cluster --service zknote-service --desired-count 4
```

### Database Backups

RDS is configured with automated backups (7 days retention). Manual snapshots can be created:
```bash
aws rds create-db-snapshot --db-instance-identifier zknote-db --db-snapshot-identifier zknote-snapshot-$(date +%Y%m%d)
```

## Cost Optimization

### Development Environment

For development/testing, you can reduce costs by:
- Using `db.t3.micro` for RDS (already configured)
- Reducing ECS task count to 1
- Using Spot instances for ECS (requires task definition modification)

### Production Recommendations

For production workloads:
- Use `db.t3.small` or larger for RDS
- Increase ECS task count based on load
- Consider using Application Auto Scaling
- Enable RDS Performance Insights

## Security Considerations

### Network Security

- ECS tasks run in private subnets
- RDS is in private subnets with no public access
- ALB is the only public-facing component
- Security groups restrict traffic appropriately

### Data Security

- RDS storage is encrypted at rest
- All traffic uses HTTPS (when SSL certificate is configured)
- Database credentials are managed securely

### Application Security

- Zero-knowledge encryption (client-side)
- Rate limiting implemented
- Security headers configured
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **ECS Tasks Not Starting**
   - Check CloudWatch logs
   - Verify security group rules
   - Check task definition and service configuration

2. **Database Connection Issues**
   - Verify RDS security group allows ECS traffic
   - Check database endpoint and credentials
   - Ensure VPC configuration is correct

3. **ALB Health Check Failures**
   - Verify application is responding on port 3000
   - Check health check path and configuration
   - Review application logs for errors

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster zknote-cluster --services zknote-service

# View recent task logs
aws logs tail /ecs/zknote --follow

# Check RDS status
aws rds describe-db-instances --db-instance-identifier zknote-db

# Test database connectivity
aws rds describe-db-instances --db-instance-identifier zknote-db --query 'DBInstances[0].Endpoint.Address'
```

## Cleanup

To destroy all resources:

```bash
cd infrastructure/terraform
terraform destroy
```

**Warning**: This will permanently delete all data and resources.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs
3. Check GitHub Actions for deployment errors
4. Verify AWS service quotas and limits 