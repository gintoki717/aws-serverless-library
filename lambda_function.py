import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

# DynamoDB 表名 - 存储书籍信息的表
TABLE_NAME = "LibraryBooks"

# S3 桶名 - 存储书籍 PDF 文件的私有桶
BUCKET_NAME = "jimmysea-plana-mylibrary-realbooks"

table = dynamodb.Table(TABLE_NAME)

# CORS 配置 - 统一管理，所有响应都使用这个配置
# 你可以先用 "*" 测试，确认没问题后再改成具体的 CloudFront 域名
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://d17998ldacan6b.cloudfront.net",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
}

def response(status, body):
    """统一的响应函数，确保所有响应都包含 CORS 头"""
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False)
    }

def lambda_handler(event, context):
    http_method = event.get("httpMethod")
    path = event.get("path", "")

    # GET /books - 返回所有书籍
    if http_method == "GET" and path == "/books":
        try:
            result = table.scan()
            return response(200, result.get("Items", []))
        except Exception as e:
            print(f"Error scanning table: {str(e)}")
            return response(500, {"message": "Internal server error", "error": str(e)})

    # GET /books/{id} - 获取单本书籍
    if http_method == "GET" and path.startswith("/books/") and not path.endswith("/download"):
        try:
            book_id = path.split("/")[-1]
            # 使用 ConsistentRead=True 确保读取最新数据，避免最终一致性问题
            result = table.get_item(Key={"BookId": book_id}, ConsistentRead=True)
            
            if "Item" not in result:
                return response(404, {"message": "Book not found"})
            
            return response(200, result["Item"])
        except Exception as e:
            print(f"Error getting book: {str(e)}")
            return response(500, {"message": "Internal server error", "error": str(e)})

    # GET /books/{id}/download - 生成 Presigned URL
    if http_method == "GET" and path.endswith("/download"):
        try:
            book_id = path.split("/")[-2]  # 获取倒数第二个路径段（book_id）
            # 使用 ConsistentRead=True 确保读取最新数据，避免最终一致性问题
            # 这对于下载功能特别重要，因为 FileKey 更新后需要立即生效
            result = table.get_item(Key={"BookId": book_id}, ConsistentRead=True)
            
            if "Item" not in result:
                return response(404, {"message": "Book not found"})
            
            file_key = result["Item"].get("FileKey")
            if not file_key:
                return response(400, {"message": "FileKey missing in book record"})
            
            # 生成 Presigned URL，有效期 1 小时
            presigned_url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": file_key
                },
                ExpiresIn=3600  # 1 hour
            )
            
            return response(200, {
                "download_url": presigned_url,
                "expires_in": 3600,
                "book_id": book_id,
                "file_key": file_key
            })
        except Exception as e:
            print(f"Error generating presigned URL: {str(e)}")
            return response(500, {"message": "Internal server error", "error": str(e)})

    # 不支持的路径
    return response(400, {"message": "Unsupported route"})

