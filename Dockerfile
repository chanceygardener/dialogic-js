# get alpine linux
FROM alpine:latest

# install node and npm
RUN apk add --update nodejs npm

# copy package.json, install dependencies
# do this before adding the rest of the files so that node_modules will be cached
ADD package.json /app/
ADD package-lock.json /app/
WORKDIR /app
RUN npm ci
# add the rest of the project files
ADD . /app/

ENTRYPOINT ["npm", "run", "serve"]
