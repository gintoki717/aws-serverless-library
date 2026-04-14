# MyLibrary - 个人图书馆（AWS Serverless）

一个部署在 AWS 上的 Serverless 个人项目，用于“加载书籍列表、获取下载链接并下载书籍”。前端通过 CloudFront 访问静态站点；后端通过 API Gateway 调用 Lambda，Lambda 访问 DynamoDB 获取书籍元数据，并为 S3 私有桶中的书籍文件生成 Presigned URL，实现客户端下载直连 S3（不经过 Lambda 传输大文件）。

A serverless personal project deployed on AWS. The frontend is served via CloudFront; the backend uses API Gateway + Lambda. Lambda reads metadata from DynamoDB and generates S3 presigned URLs so clients can download files directly from a private S3 bucket (without streaming large files through Lambda).

## 功能特性
- **书籍列表加载**：从 DynamoDB 读取书籍元数据（书名/作者/ID 等）。
- **下载书籍**：后端生成 **S3 Presigned URL**，客户端使用该 URL **直接从 S3 下载**（降低延迟与成本）。
- **安全访问静态站点**：S3 前端桶开启 Block Public Access，通过 CloudFront **OAC** 访问源站。
- **自动化部署（CI/CD）**：使用 GitHub Actions 自动部署前端到 S3 + CloudFront 刷新缓存，并自动更新后端 Lambda 代码。

Features (EN)
- **Load books metadata** from DynamoDB.
- **Download via S3 presigned URL** (direct-to-S3 download).
- **Secure static hosting**: S3 Block Public Access + CloudFront OAC.
- **CI/CD**: GitHub Actions deploys frontend (S3 + CloudFront invalidation) and backend (Lambda update-function-code).

## 在线 Demo 链接
- **CloudFront Domain (Frontend)**: https://d17998ldacan6b.cloudfront.net
- **API Gateway Invoke URL (Base URL)**: https://szpo4xcaqj.execute-api.us-east-1.amazonaws.com/prod
- **Books list**: GET https://szpo4xcaqj.execute-api.us-east-1.amazonaws.com/prod/books
- **Book detail (example: read-002)**: GET https://szpo4xcaqj.execute-api.us-east-1.amazonaws.com/prod/books/read-002
- **Download (example: read-002)**: GET https://szpo4xcaqj.execute-api.us-east-1.amazonaws.com/prod/books/read-002/download
 
提示：不要直接访问 `.../prod`（Base URL 根路径），否则可能返回 `Missing Authentication Token`；请访问上述具体路由。

Demo Links (EN)
- **Frontend**: CloudFront domain above.
- **Backend**: API Gateway base URL above.
- Tip: do not open the Base URL root path directly (it may return `Missing Authentication Token`). Use the routes above.

## 架构概览
![alt text](<Architecture Diagram.png>)
- **Frontend**：S3（静态资源） + CloudFront（CDN）
- **Backend**：API Gateway（REST API） + Lambda（业务逻辑）
- **Data**：DynamoDB（书籍元数据） + S3（书籍文件，私有桶）
- **AuthZ**：Lambda 通过 **Lambda Execution Role** 访问 DynamoDB/S3

Architecture (EN)
- **Frontend**: S3 + CloudFront
- **Backend**: API Gateway (REST) + Lambda
- **Data**: DynamoDB + S3 (private books bucket)
- **AuthZ**: Lambda accesses DynamoDB/S3 via **Lambda Execution Role**

核心数据流：
- **访问站点**：User -> CloudFront -> S3（Frontend Bucket，OAC）
- **获取列表/下载链接**：Frontend -> API Gateway -> Lambda
- **下载文件**：Lambda 返回 Presigned URL；User/Browser -> S3（Books Bucket）

## CI/CD（GitHub Actions）
![alt text](<library CICD-1.png>)

CI/CD (EN)
- Frontend: sync static assets to S3 + invalidate CloudFront cache.
- Backend: zip Lambda code and update function code via AWS CLI.

### 前端：部署到 S3 + CloudFront
Workflow：`.github/workflows/deploy-frontend.yml`

触发条件：
- push 到 `main`
- 且变更路径包含：`index.html` / `style.css` / `script.js` / workflow 文件

执行逻辑：
- Checkout
- 配置 AWS Credentials（从 GitHub Secrets 读取）
- `aws s3 sync` 将静态文件同步到 S3
- `aws cloudfront create-invalidation` 刷新缓存（`/*`）

### 后端：更新 Lambda Function Code
Workflow：`.github/workflows/deploy-backend.yml`

触发条件：
- push 到 `main`
- 且变更路径包含：`Backend/**`

执行逻辑：
- Checkout
- 配置 AWS Credentials（从 GitHub Secrets 读取）
- 打包 `Backend/lambda_function.py` 为 zip
- `aws lambda update-function-code` 更新目标函数（如：`MyLibraryAPI`）

## GitHub Secrets 配置

### 前端 CI/CD 需要
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

### 后端 CI/CD 需要
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`（或在 workflow 中写死 region，但更推荐用 Secret 统一管理）

说明：
- Secrets 是 **Repository-level** 的，同一个仓库内前后端 workflow 可以复用。
- IAM 权限建议遵循 **最小权限原则**：
  - 前端：S3 sync + CloudFront invalidation
  - 后端：`lambda:UpdateFunctionCode`、`lambda:GetFunction`（按需扩展）

## 安全要点
- **S3（Frontend Bucket）**：Block Public Access 开启，CloudFront 通过 OAC 访问。
- **S3（Books Bucket）**：私有桶，不对公网开放，通过 Presigned URL 提供限时下载。
- **Lambda Execution Role**：只授予访问 DynamoDB/S3 的最小权限。
- **CI/CD Credentials**：当前使用 GitHub Secrets 保存访问密钥；可进一步升级为 GitHub OIDC + AssumeRole（临时凭证）以提升安全性。

## 本地开发（可选）
- 前端是纯静态文件，可直接用本地静态服务器预览（或直接打开 `Frontend/index.html`）。
- 后端为 AWS Lambda 运行环境（Python），建议在 AWS 控制台/测试事件或通过 API Gateway 调用验证。
