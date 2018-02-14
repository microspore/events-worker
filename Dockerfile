# Use an official Python runtime as a parent image
FROM node:8

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
ADD . ${WORKDIR}
ADD ./events-db events-db/
ADD ./queue queue/

ENV NEWRELIC_KEY ee692bf0c7e064e9f1cd4a207ff5e7431206b6cb
ENV AWS_ACCESS_KEY_ID AKIAIAKIEPXTTVTXT4LQ
ENV AWS_SECRET_ACCESS_KEY 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

# Install any needed packages specified in package.json
RUN npm install



# Run app.py when the container launches
CMD ["node", "index.js"]