'use strict';
var AWS = require('aws-sdk');
var response = require('./cfn-response')
var url = require('url');
var https = require('https');
var fs = require('fs');
var request = require('request');
var s3 = new AWS.S3();


var myBucket = "";
var oktaOrg = "";

// Retrieve HTML form Github repo for login widget, you can use your own
let getHtmlFromGithub = function (fetchedUrl) {
    return new Promise(function (resolve, reject) {
        var options = {
            method: 'GET',
            url: 'https://raw.githubusercontent.com/pmcdowell-okta/cloudformation-deploy-okta-login-widget/master/html/index.html',
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'a',
                    accept: 'application/json'
                },
            body: ''
        };

        request(options, function (error, response, body) {
            if (error) reject (error);
            resolve(body);
        });
    })
}

let createS3Bucket = function (bucketname, callback) {
    return new Promise(function (resolve, reject) {
        s3.createBucket({Bucket: bucketname, ACL: 'public-read'}, function (err, data) {
            if (err) {
                console.log(err)

                if (err.code == "BucketAlreadyExists") { //no sweat.. already there
                    resolve()
                }
                else { //maybe bucketname didn't meet requirements ?
                    reject(err)
                }
            } else {
                resolve()
            }
        });

    });
}

let createIndexFile = function (nameOfBucket, nameOfFile, myHtml) {
    return new Promise(function (resolve, reject) {
        var metaData = 'text/html';
        var fileString = myHtml.replace("{oktaOrg}", oktaOrg)
        var buf = Buffer.from(fileString, 'utf-8');

        s3.putObject({
            ACL: 'public-read',
            Bucket: nameOfBucket,
            Key: nameOfFile,
            Body: buf,
            ContentType: metaData
        }, function (error, response2) {
            resolve('done')

        });
    })
}

let deleteS3Bucket = function(bucketname, callback) {
    return new Promise(function(resolve, reject) {
        var params = {
            Bucket: bucketname,
            Delete: { // required
                Objects: [ // required
                    {
                        Key: myKey // required
                    }
                ],
            },
        };

        s3.deleteObjects(params, function(err, data) {
            if (err) {
                if ( err.code == "NoSuchBucket") {  // No sweat, bucket doesn't exist
                    resolve()
                }
                else {
                    callback(err)

                }
            }
            else {
                console.log("File gone");
                s3.deleteBucket({Bucket: myBucket}, function (err, data) {
                    if (err) {
                        callback ( err )
                    } else {
                        resolve () // All good
                    }
                });

            } // successful response
        });

    });
}



exports.handler = (event, context, callback) => {

    console.log("start")
    myBucket = event.ResourceProperties['bucketname']
    oktaOrg = event.ResourceProperties['oktaOrg']

    // You can change this, or even pull from the file system, this is just an example
    var tempUrl = "https://raw.githubusercontent.com/pmcdowell-okta/cloudformation-deploy-okta-login-widget/master/html/index.html"

    if (event.RequestType == 'Create') {

        getHtmlFromGithub(tempUrl).then(function resolve(myHtml) {
            console.log("in Create")
            // console.log(myHtml)
            createS3Bucket(myBucket, myHtml).then(function () {
                createIndexFile(myBucket, "index.html", myHtml)
                    .then(function () {
                        response.send(event, context, response.SUCCESS, {});

                    }).catch(function (err) {
                    response.send(event, context, response.FAILED, {});

                })
            })
            // response.send(event, context, response.SUCCESS, {"canyou": "seeme"});
        }, function reject(err) {
            response.send(event, context, response.FAILED, {});
        })

    } else if (event.RequestType == 'Delete') {
        console.log("in Delete") // Clean up the S3 Bucket, delete everything
        deleteS3Bucket(myBucket, callback).then(function () {
            response.send(event, context, response.SUCCESS, {});
        })
    } else {
        console.log(event)
        console.log(context)
        response.send(event, context, response.SUCCESS, {});
    }
}


