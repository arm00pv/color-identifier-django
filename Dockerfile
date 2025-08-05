# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables to prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# **FIX**: Copy all files from the current directory into the container's /app directory.
# This ensures that 'mysite', 'public', and 'colors.csv' are all included.
COPY . .

# Now that all files are copied, run pip install using the requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port that Gunicorn will run on.
EXPOSE 8080

# Run the Gunicorn server when the container starts
# The --chdir flag tells gunicorn to run from within the 'mysite' directory
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--chdir", "mysite", "mysite.wsgi"]
