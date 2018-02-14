# Use an official Python runtime as a parent image
FROM node:8

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
ADD . ${WORKDIR}
ADD ./events-db events-db/
ADD ./queue queue/

# Install any needed packages specified in package.json
RUN npm install



# Run app.py when the container launches
CMD ["node", "index.js"]