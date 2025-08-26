#!/bin/sh

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until mc alias set minio http://minio:9000 minioadmin minioadmin123; do
  echo "MinIO not ready yet, waiting..."
  sleep 2
done

echo "MinIO is ready!"

# Create default bucket
echo "Creating default bucket..."
mc mb minio/default-bucket

# Set bucket policy for public read access (optional)
echo "Setting bucket policy..."
mc policy set download minio/default-bucket

# Create additional buckets for different purposes
echo "Creating additional buckets..."
mc mb minio/uploads
mc mb minio/documents
mc mb minio/images
mc mb minio/temp

# Set policies for different buckets
mc policy set download minio/images
mc policy set private minio/documents
mc policy set private minio/uploads

echo "MinIO setup completed!"
echo "Buckets created:"
mc ls minio

echo "Setup script completed successfully!" 