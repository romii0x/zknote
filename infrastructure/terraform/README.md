# zknote Infrastructure

This directory contains the Terraform configuration for deploying zknote to AWS.

## Architecture

The infrastructure creates a complete AWS environment for running zknote:

- **VPC** with public and private subnets across 2 AZs
- **RDS PostgreSQL** database in private subnets
- **ECS Fargate** cluster for running the application
- **Application Load Balancer** for traffic distribution
- **ECR** repository for Docker images
- **CloudWatch** for logging and monitoring
- **EventBridge** for scheduled cleanup jobs

## Components

### Networking
- VPC with CIDR `10.0.0.0/16`
- 2 public subnets for ALB and ECS (cost optimized)
- 2 private subnets for RDS only
- **No NAT Gateway** - ECS uses public subnets for direct internet access

### Security Groups
- **ALB**: Allows HTTP/HTTPS from internet
- **ECS**: Allows traffic from ALB on port 3000
- **RDS**: Allows PostgreSQL traffic from ECS only

### Database
- PostgreSQL 15.4 on RDS
- `db.t3.micro` instance
- Encrypted storage
- Automated backups (7 days retention)
- Private subnet placement

### Application
- ECS Fargate with 1 task (cost optimized)
- 256 CPU units, 512MB memory per task
- **Auto-scaling with scale-to-zero** (0-2 tasks based on usage)
- Health checks and automatic recovery
- Public subnet placement for direct internet access

### CI/CD
- GitHub Actions workflow for automated deployment
- ECR for Docker image storage
- Blue-green deployment strategy

## Usage

### Prerequisites

1. AWS CLI configured
2. Terraform 1.0+
3. S3 bucket for Terraform state
4. IAM user with appropriate permissions

### Deployment

1. **Configure variables**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

2. **Initialize Terraform**:
   ```bash
   terraform init
   ```

3. **Plan deployment**:
   ```bash
   terraform plan
   ```

4. **Apply configuration**:
   ```bash
   terraform apply
   ```

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region for resources | `us-east-2` |
| `environment` | Environment name | `production` |
| `db_password` | Database password | Required |
| `domain_name` | Custom domain name | Optional |
| `certificate_arn` | SSL certificate ARN | Optional |

### Outputs

After deployment, Terraform will output:

- `alb_dns_name`: Load balancer URL
- `ecr_repository_url`: ECR repository URL
- `rds_endpoint`: Database endpoint

## Cost Estimation

Monthly costs (us-east-2) - **Optimized Configuration**:

### Current Optimized Costs:
- **RDS**: ~$15-20 (db.t3.micro)
- **ECS**: ~$15-50 (1 task + auto-scaling 0-2)
- **ALB**: ~$18
- **NAT Gateway**: $0 (removed for cost optimization)
- **Data Transfer**: ~$5-10
- **Other**: ~$5-10 (CloudWatch, EventBridge, etc.)
- **Total**: ~$58-108/month

### Cost Optimization Features:
-  **No NAT Gateway** (saves ~$45/month)
-  **Scale-to-zero auto-scaling** (saves when not used)
-  **Single ECS task** (reduced from 2)
-  **Public subnet placement** (direct internet access)

### Usage-Based Costs:
- **Zero usage**: ~$36-37/month
- **Low usage (0-300 users)**: ~$52-58/month  
- **Medium usage (300-1000 users)**: ~$59-72/month
- **High usage (1000+ users)**: ~$72-104/month

**Savings**: ~50-60% reduction from original ~$120-140/month

## Security

### Network Security
- All resources in VPC
- Private subnets for RDS only
- Public subnets for ECS (cost optimized, still secure)
- Security groups with minimal required access
- No direct internet access to RDS
- ECS protected by ALB and security groups

### Data Security
- RDS encryption at rest
- TLS encryption in transit
- IAM roles with least privilege
- Secure parameter storage

### Application Security
- Zero-knowledge encryption (client-side)
- Rate limiting and DDoS protection
- Security headers and CSP
- Input validation and sanitization

## Monitoring

### Logs
- Application logs in CloudWatch
- Database logs in RDS
- ALB access logs (optional)

### Metrics
- ECS service metrics
- RDS performance metrics
- ALB health check metrics

### Alerts
- ECS service health
- RDS connection count
- ALB error rate

## Maintenance

### Updates
- Application updates via CI/CD
- Infrastructure updates via Terraform
- Database updates via RDS maintenance windows

### Backups
- Automated RDS backups
- Manual snapshots for major changes
- Terraform state backups in S3

### Scaling
- **Auto-scaling with scale-to-zero** (0-2 tasks based on CPU usage)
- Horizontal scaling via ECS service updates
- Vertical scaling via task definition updates
- **Cost-optimized scaling** - scales down to 0 when not used

## Troubleshooting

### Common Issues

1. **ECS Tasks Not Starting**
   - Check CloudWatch logs
   - Verify security group rules
   - Check task definition

2. **Database Connection Issues**
   - Verify RDS security group
   - Check database endpoint
   - Test connectivity

3. **ALB Health Check Failures**
   - Verify application health
   - Check security group rules
   - Review application logs

### Useful Commands

```bash
# Check ECS service
aws ecs describe-services --cluster zknote-cluster --services zknote-service

# View logs
aws logs tail /ecs/zknote --follow

# Check RDS
aws rds describe-db-instances --db-instance-identifier zknote-db

# Test ALB
curl -I http://your-alb-url
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will permanently delete all data and resources. 