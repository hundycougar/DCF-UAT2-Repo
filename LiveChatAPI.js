var botId = "st-06525b6f-bab3-5f0b-b9e0-22246e4ad9b2";
var botName = "FL Access Phase 2";
var sdk = require("./lib/sdk");
var Promise = require("bluebird");
var request = require("request-promise");
var template = require("url-template");
var soap = require("soap");
var convert = require('xml-js');

// var initUrl = "http://160.131.251.22/WebChatWebService/Service.asmx?wsdl";
// function initChat(visitorId, data) {

//     console.log("DEBUG-API-initChat Data ",data);
//     var options = {
//         serviceID: "EMCChat",
//         userID: "BotKitSDK",
//         password: "",
//         initialQuestion: data,
//         cultureID: "en-US",
//         priority: 5,
//         updateInterval: 10,
//     };

//     return new Promise((resolve, reject) => {soap.createClient(initUrl, function (err, client) {
//            // console.log(client.describe());
//            client.addHttpHeader('Connection', 'keep-alive');
//            client.addHttpHeader('Accept-Encoding', 'gzip,deflate');
//             client.OpenSession(options, function (err, result) {
//                 console.log(result);
//                 resolve(result);
//             });
//         });
//     })
// }

var initUrl = "http://160.131.251.22/WebChatWebService/Service.asmx/OpenSession?serviceID=EMCChat&userID=string&password=string&initialQuestion=string&cultureID=string&priority=5&updateInterval=5";
function initChat(visitorId, data) {
    var url = template.parse(initUrl).expand({ visitorId: visitorId });
    var options = {
        method: 'GET',
        uri: initUrl,
        headers: {
            'Content-type': 'text/xml; charset=utf-8',  // Set automatically
            'Connection': 'Keep-Alive',
            'Accept-Encoding': 'gzip,deflate'
        }
    };
    console.log("DEBUG-InitChat", initUrl);
    return request(options).then(function (res) {
        var result = convert.xml2json(res, { compact: true, spaces: 4 });
        return JSON.parse(result);
    })
        .catch(function (err) {
            return Promise.reject(err);
        });
}

var closeUrl = "http://160.131.251.22/WebChatWebService/Service.asmx/CloseSession?"
function closeSession(secureSessionId, reason) {
    var url = closeUrl+"serviceToken=EMCChat&SessionID="+secureSessionId+"&reason="+reason;
    var options = {
        method: 'GET',
        uri: url,
        headers: {
            'Content-type': 'text/xml; charset=utf-8',  // Set automatically
            'Accept-Encoding': 'gzip,deflate'
        }
    };
    return request(options).then(function (res) {
        return res;
    })
    .catch(function (err) {
        return Promise.reject(err);
    });
}

var sendMsgUrl = "http://160.131.251.22/WebChatWebService/Service.asmx?wsdl";
function sendMsg(visitorId, data) {

    console.log("DEBUG-API-SendMessageToService", JSON.stringify(data));
    var options = {
        //serviceToken: "EMCChat",
        SessionID: data.secure_session_id,
        message: [data.message]
    };

    return new Promise((resolve, reject) => {
        soap.createClient(sendMsgUrl, function (err, client) {
            client.addHttpHeader('Connection', 'keep-alive');
            client.addHttpHeader('Accept-Encoding', 'gzip,deflate');
            client.SendMessageToService(options, function (err, result) {
                console.log("DEBUG-API-SendMessageToUser Err", err, "result", result)
                if (err !== undefined && err !== null) {
                    reject(err);
                } else if (result !== undefined) {
                    resolve(result);
                }

            });
        });
    })
}

var getMsgUrl = "http://160.131.251.22/WebChatWebService/Service.asmx?wsdl";
function getPendingMessages(visitorId, ssid, last_message_id) {

    //console.log("DEBUG-API-Getting PendingMessages",data);
    var options = {
        ServiceID: "EMCChat",
        SessionID: ssid,
    };
    console.log("DEBUG-API-Getting PendingMessages - ssid:", ssid);
    return new Promise((resolve, reject) => {
        soap.createClient(getMsgUrl, function (err, client) {
            client.addHttpHeader('Connection', 'keep-alive');
            client.addHttpHeader('Accept-Encoding', 'gzip,deflate');
            client.RecieveMessagesForUser(options, function (err, result) {
                // console.log("DEBUG-API-GetPendingMessages Err", err, "result",result)
                if (err !== undefined && err !== null) {
                    reject(err);
                } else if (result !== undefined) {
                    //console.log("DEBUG-API-GetPendingMessages result",result);
                    resolve(result);
                }

            });
        });
    })
}
module.exports.initChat = initChat;
module.exports.sendMsg = sendMsg;
module.exports.getPendingMessages = getPendingMessages;
module.exports.closeSession = closeSession;
