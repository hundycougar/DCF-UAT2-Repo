var botId = "st-06525b6f-bab3-5f0b-b9e0-22246e4ad9b2";
var botName = "FL Access Phase 2";
var sdk = require("./lib/sdk");
var request = require('request');
var Promise = require('bluebird');
var request = Promise.promisify(request);
var api = require('./LiveChatAPI.js');
var _ = require('lodash');
var config = require('./config.json');
var debug = require('debug')("Agent");
var schedular = require('node-schedule');
var _map = {}; //used to store secure session ids //TODO: need to find clear map var
var avayaList = {};
var userDataMap = {};//this will be use to store the data object for each user
var userResponseDataMap = {};
var redisOperations = require("./redisOperations.js");
/**
* getPendingMessages
*
* @param {string} visitorId user id
* @param {string} ssid session id of the live chat
* @param {string} last message sent/received to/by agent 
*/
function getPendingMessages(visitorId, ssid, last_message_id, cb) {
    console.log("DEBUG-liveChat-getPendingMessages: %s %s ", visitorId, ssid);
    // var licence_id = config.liveagentlicense;
    return api.getPendingMessages(visitorId, ssid, last_message_id)
        .then(function (res) {
            _.each(res.RecieveMessagesForUserResult, function (event) {
                //console.log("DEBUG-liveChat-getPendingMessages ---> userDataMap ",userDataMap )
                var data = userDataMap[visitorId];

                let messages = event;
                if (Array.isArray(messages)) {
                    _.each(messages, function (msgobj) {
                        console.log('DEBUG-liveChat-getPendingMessages-chat messages', msgobj);
                        let msg = msgobj.split(":")
                        if (msg[1] === "CloseSession") {
                            console.log('DEBUG-liveChat-getPendingMessages-closed');
                            data.message = (msg != undefined && msg.length == 3 ? msg[2] : msg[1]);
                            data._originalPayload.message = data.text;
                            return sdk.sendUserMessage(data, function (err) {
                                redisOperations.updateRedisconnectedAgent(ssid, false)
                                .then(function () {
                                    redisOperations.setTtl(ssid, false);
                                });
                                redisOperations.deleteRedisData("conversationId:" + ssid);
                                redisOperations.deleteRedisData("visitorId:" + visitorId);
                                redisOperations.deleteRedisData("convid:" + ssid);
                                redisOperations.deleteRedisData("token:" + ssid);    
                                redisOperations.getRedisData("hashallVisitorIds").then(function(vistors){
                                    let vistorsData = undefined;
                                    if(vistors!==undefined){
                                        let vistorsData = {...vistors};
                                        delete vistorsData[visitorId];
                                        redisOperations.updateRedisWithVisitorsIds(vistorsData).then(function(res){
                                            console.log("Updated all the Visitors Ids successfully");
                                        });
                                    }
                                });                            
                                delete userResponseDataMap[visitorId];
                                delete _map[visitorId];
                                sdk.clearAgentSession(data);
                                console.log("sendMessage  ------ >", err);
                            }).catch(function (e) {
                                console.log("Got the Error in closing session -------> ", e);
                                //debug("sending agent reply error", e);
                                redisOperations.updateRedisconnectedAgent(ssid, false)
                                .then(function () {
                                    redisOperations.setTtl(ssid, false);
                                });
                                redisOperations.deleteRedisData("conversationId:" + ssid);
                                redisOperations.deleteRedisData("visitorId:" + visitorId);
                                redisOperations.deleteRedisData("convid:" + ssid);
                                redisOperations.deleteRedisData("token:" + ssid);  
                                redisOperations.getRedisData("hashallVisitorIds").then(function(vistors){
                                    let vistorsData = undefined;
                                    if(vistors!==undefined){
                                        let vistorsData = {...vistors};
                                        delete vistorsData[visitorId];
                                        redisOperations.updateRedisWithVisitorsIds(vistorsData).then(function(res){
                                            console.log("Updated all the Visitors Ids successfully");
                                        });
                                    }
                                });    
                                delete userResponseDataMap[visitorId];
                                delete _map[visitorId];
                                sdk.clearAgentSession(userDataMap);
                            });
                        } else if (msg.includes("TypingUser")) {
                            console.log("Debug-LiveChat-Agent is tip typing away");
                        } else if (msg.includes("SendChatHistory")) {
                            console.log("Debug-LiveChat-Sending chat history");
                            gethistory(visitorId, ssid, res);
                        } else {
                            console.log('DEBUG-liveChat-getPendingMessages-chat messages ********', msg[2]);
                            data.message = msg[2];
                            data._originalPayload.message = data.text;
                            //Storing user data as a value and securesession id  as key
                            redisOperations.updateRedisWithUserData(ssid, data).then(function () {
                                redisOperations.setTtl(ssid, data);
                            });
                            return sdk.sendUserMessage(data, function (err) {
                                console.log("sendMessage  ------ >", err);
                            }).catch(function (e) {
                                console.log("Got the Error in sending messages-------> ", e);
                                //debug("sending agent reply error", e);
                                delete userResponseDataMap[visitorId];
                                delete _map[visitorId];
                                sdk.clearAgentSession(userDataMap);
                            });
                        }
                    })
                }
            });
        });
}

/*
* Schedule a joob to fetch messages every 5 seconds 
 */
schedular.scheduleJob('*/5 * * * * *', function () {
    debug('DEBUG-liveChat -schedular triggered');
    var promiseArr = [];
    //Updating the allVistorId data list with new vistorId
    redisOperations.getRedisData("hashallVisitorIds").then(function(vistors){
        _.each(vistors, function (entry) {
            promiseArr.push(getPendingMessages(entry.visitorId, entry.secure_session_id, entry.last_message_id));
        });
    });
    return Promise.all(promiseArr).then(function () {
        debug('DEBUG-liveChat- -sheduled finished');
    }).catch(function (e) {
        debug('DEBUG-liveChat -error in schedular', e);
    });
});
/*function gethistory(req, res) {
    var userId = req.query.userId;
    var data = userDataMap[userId];

    if (data) {
        data.limit = 100;
        return sdk.getMessages(data, function (err, resp) {
            if (err) {
                res.status(400);
                return res.json(err);
            }
            var messages = resp.messages;
            res.status(200);
            return res.json(messages);
        });
    } else {
        var error = {
            msg: "Invalid user",
            code: 401
        };
        res.status(401);
        return res.json(error);
    }
}*/
function gethistory(vid,ssid,res) {
    var userId = vid;
    console.log("vid: ",vid);
    //var data = userDataMap[userId]; data.userId = data.chanel.userId 
    var entryRedis = redisOperations.getRedisData("conversationId:" + ssid ).then(function (data) 
    {
       //console.log(JSON.stringify(data));
        if (data) {
        data.limit = 100;
        data.userId = vid;
        console.log(JSON.stringify(data));
        console.log("Getting chat history and data IS defined");
        return sdk.getMessages(data, function (err, resp) {
            if (err) {
                console.log("Error doing sdk.getMessages")
                res.status(400);
                return res.json(err);
            }
            var messages = resp.messages;
            var allMessages = [];
            _.each(messages, function (entry) {
                allMessages.push(entry.components[0].data.text);
               
            });


            console.log("messages: ",allMessages);
           //res.status(200);
           // return res.json(messages);
           if (allMessages!=undefined && allMessages.length>0 ){
           let formData = {
            secure_session_id: ssid,
            message:allMessages.join(',')
            };
           api.sendMsg(ssid, formData).catch(function (e) {
            console.error(e);
            //Deleting all the information related to a secure session from Redis
            redisOperations.deleteRedisData("conversationId:" + data.secure_session_id);
            redisOperations.deleteRedisData("visitorId:" + vid);
            redisOperations.deleteRedisData("convId:" + data.secure_session_id);
            redisOperations.deleteRedisData("token:" + data.secure_session_id);

            //delete userDataMap[vid];
            //delete _map[vid];
            /*return sdk.sendBotMessage(data, function(error){
                console.log("sendbotmessage error location");
            })*/
        });}
        });
    } else {
        var error = {
            msg: "Invalid user",
            code: 401
        };
        res.status(401);
        return res.json(error);
    }});
}
/**
* connectToAgent
*
* @param {string} requestId request id of the last event
* @param {object} data last event data
* @returns {promise}
*/
function connectToAgent(requestId, data, cb) {
    var formdata = {};
    var actualMessage;
    actualMessage = _.get(data, 'message');

    //not needed - for liveagent chat  formdata.licence_id = config.liveagentlicense;
    formdata.welcome_message = "";
    var visitorId = _.get(data, 'channel.channelInfos.from');
    if (!visitorId) {
        visitorId = _.get(data, 'channel.from');
    }
    console.log("DEBUG-liveChat-ConnectToAgent - visitor id", visitorId);
    userDataMap[visitorId] = data;

    data.message = "An Agent will be assigned to you shortly!!!";
    sdk.sendUserMessage(data, cb);
    if (actualMessage) { formdata.welcome_message = "Link for user Chat history with bot: " + config.app.url + "/history/index.html?visitorId=" + visitorId + "\n" + actualMessage; }
    else { formdata.welcome_message = "Link for user Chat history with bot: " + config.app.url + "/history/index.html?visitorId=" + visitorId };
    return api.initChat(visitorId, formdata)
        .then(function (res) {
            _map[visitorId] = {
                secure_session_id: res.string._text,
                visitorId: visitorId,
                last_message_id: 0
            };
            console.log("DEBUG-liveChat-ConnectToAgent -map", JSON.stringify(_map), "and res", res, "****************");
            //Updating the allVistorId data list with new vistorId
            redisOperations.getRedisData("hashallVisitorIds").then(function(vistors){
                let vistorsData = undefined;
                console.log("DEBUG-liveChat-ConnectToAgent ---->",vistors);
                if(vistors!==undefined){
                    vistorsData = {...vistors};
                    vistorsData[visitorId] = {
                        secure_session_id: res.string._text,
                        visitorId: visitorId,
                        last_message_id: 0
                    }
                }else{
                    vistorsData = {};
                    vistorsData[visitorId] = {
                        secure_session_id: res.string._text,
                        visitorId: visitorId,
                        last_message_id: 0
                    }
                }
                console.log("DEBUG-liveChat-ConnectToAgent ---->",vistorsData);
                redisOperations.updateRedisWithVisitorsIds(vistorsData).then(function(res){
                    console.log("Updated all the Visitors Ids successfully");
                });
            });

            // Storing the securesession id in redis by passing visitor id 
            redisOperations.updateRedisWithData(visitorId, _map[visitorId])
                .then(function () {
                    redisOperations.setTtl(visitorId, _map[visitorId]);
                });
            //Storing user data as a value and securesession id  as key
            redisOperations.updateRedisWithUserData(res.string._text, data)
                .then(function () {
                    redisOperations.setTtl(res.string._text, data);
                });
            // Storing the connectedToAgent status in redis using  secure session id
            redisOperations.updateRedisconnectedAgent(res.string._text, true)
                .then(function () {
                    redisOperations.setTtl(res.string._text, false);
                });
        });
}

/*
* onBotMessage event handler
*/
function onBotMessage(requestId, data, cb) {
    //debug("Bot Message Data",data);
    var visitorId = _.get(data, 'channel.from');
    var entry = _map[visitorId];
    if (data.message.length === 0 || data.message === '') {
        return;
    }
    var message_tone = _.get(data, 'context.dialog_tone');
    if (message_tone && message_tone.length > 0) {
        var angry = _.filter(message_tone, { tone_name: 'angry' });
        if (angry.length) {
            angry = angry[0];
            if (angry.level >= 2) {
                connectToAgent(requestId, data);
            }
            else {
                sdk.sendUserMessage(data, cb);
            }
        }
        else {
           sdk.sendUserMessage(data, cb);
        }
    }
    else if (!entry) {
        sdk.sendUserMessage(data, cb);
    }
}

/*
* OnUserMessage event handler
*/
function onUserMessage(requestId, data, cb) {
    var visitorId = _.get(data, 'channel.from');
    var entry123 = _map[visitorId]; //this is going to dummy variable
    //Reading the visitorId Details from redis
    var entryRedis = redisOperations.getRedisData("visitorId:" + visitorId).then(function (entry) {
        if (entry) {//check for live agent
            console.log("DEBUG-liveChat-OnUserMessage -entry -", JSON.stringify(entry));
            //updating the data in the Redis store by passing the update data of that securesession id
            var userDataMapRedis = redisOperations.updateRedisWithUserData(entry.secure_session_id, data)
                .then(function () {
                    redisOperations.setTtl(entry.secure_session_id, data);
                });
            if (data.message === "endAgentChat") {
                console.log("to agent clear session" + entry.secure_session_id + " visitorId: " + visitorId);
                //calling close session if user wants to end chat with agent
                return api.closeSession(entry.secure_session_id, data.message).then(function (res) {
                    console.log(" chat_closed");
                    redisOperations
                        .updateRedisconnectedAgent(entry.secure_session_id, false)
                        .then(function () {
                            redisOperations.setTtl(entry.secure_session_id, false);
                        });
                    redisOperations.deleteRedisData("conversationId:" + entry.secure_session_id);
                    redisOperations.deleteRedisData("visitorId:" + entry.visitorId);
                    redisOperations.deleteRedisData("convid:" + entry.secure_session_id);
                    redisOperations.deleteRedisData("token:" + entry.secure_session_id);
                    sdk.clearAgentSession(data).then(function () {
                        data.message = "Chat closed.";
                        return sdk.sendBotMessage(data);
                    })
                })
            } else {
                //Making the parameters for soap request to sendMsg to Service
                var formdata = {};
                formdata.secure_session_id = entry.secure_session_id;
                formdata.message = data.message;

                console.log("DEBUG-liveChat-OnUserMessage -formdata -", JSON.stringify(formdata), "entry ssid", _.get(entry, 'secure_session_id'));
                //Calling the API Service - sendMsg
                return api.sendMsg(visitorId, formdata).catch(function (e) {
                    console.error(e);
                    //Deleting all the information related to a secure session from Redis
                    redisOperations.deleteRedisData("conversationId:" + entry.secure_session_id);
                    redisOperations.deleteRedisData("visitorId:" + visitorId);
                    redisOperations.deleteRedisData("convId:" + entry.secure_session_id);
                    redisOperations.deleteRedisData("token:" + entry.secure_session_id);

                    delete userDataMap[visitorId];
                    delete _map[visitorId];
                    return sdk.sendBotMessage(data, cb);
                });
            }
        } else {
            return sdk.sendBotMessage(data, cb);
        }
    })
}

/*
* OnAgentTransfer event handler
*/
function onAgentTransfer(requestId, data, callback) {
    connectToAgent(requestId, data, callback);
}

module.exports = {
    botId: botId,
    botName: botName,
    on_user_message: async function (requestId, data, callback) {
        var visitorId = _.get(data, 'channel.from');
        console.log("DEBUG-liveChat-Exports -visitorID -", visitorId);
        // console.log('data', data);

        debug('on_user_message');
        var entry2 = _map[visitorId];
        console.log("DEBUG-liveChat-Exports- entry2", JSON.stringify(entry2));
        if (entry2) {
            console.log("DEBUG-liveChat-Exports if entry2 success");
            onUserMessage(requestId, data, callback);
        } else {
            console.log("DEBUG-liveChat-Exports if entry2 NOT success");
            await connectToAgent(requestId, data, callback);
            getPendingMessages(visitorId, _map[visitorId].secure_session_id, 0, callback, data);
        }
    },
    on_bot_message: function (requestId, data, callback) {
        debug('on_bot_message');
        onBotMessage(requestId, data, callback);
    },
    on_agent_transfer: function (requestId, data, callback) {
        debug('on_webhook');
        onAgentTransfer(requestId, data, callback);
        //onUserMessage(requestId, data, callback);
    },
    gethistory: gethistory
};
