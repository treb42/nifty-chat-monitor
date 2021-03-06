// ==UserScript==
// @name           Nifty Chat Monitor
// @namespace      http://somewhatnifty.com
// @description    reformats twitch chat for display on a chat monitor
// @match        https://www.twitch.tv/*/chat?display*
// @version    0.1
// @require  https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       GM_getResourceText
// @grant       GM_addStyle
// @require  https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_log
// @resource style https://raw.githubusercontent.com/paul-lrr/nifty-chat-monitor/master/chat-monitor.css
// @resource material-icons https://fonts.googleapis.com/icon?family=Material+Icons
// ==/UserScript==

let getQS = (str)=>{
    let a, q = {},r = /([^?=&\r\n]+)(?:=([^&\r\n]*))?/g;
    while ((a = r.exec(str)) !== null) {
        q[a[1]] = a[2]||'';
    }
    return q;
};

var qs = getQS(location.search);

var inlineImages = false;

//Create config page fields
//Fields appear in the order written below.
var configFields = {
    "HideChatInput": { //Id for field in html
        "label" : "Hide Chat Input Area", //Label that appears on the config
        "type" : "checkbox",
        "default" : true
    },
    "ReverseDirection": {
        "label" : "New messages appear on top",
        "type" : "checkbox",
        "default" : true
    },
    "InlineImages": {
        "label" : "Display images that are linked",
        "type" : "checkbox",
        "default" : true
    },
    "CustomHighlighting": {
        "label" : "CSS User Highlighting",
        "type" : "textarea",
        //Keeping CSS in from chat-monitor-highlight.css as an example of what you can do
        "default" : ".chat-lines li[data-badges*='Moderator'] .from {\n" +
                        "\tcolor: #8383f9 !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-badges*='Broadcaster'] {\n" +
                        "\tbackground-color: #000090 !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-badges*='Broadcaster'] .from {\n" +
                        "\tcolor: #00b5e0 !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-user='LRRbot'] .from {\n" +
                        "\tcolor:purple !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-user='LRRbot'][data-message*='thanks for']{\n" +
                        "\tbackground-color:purple !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-user='LRRbot'][data-message*='thanks for'] .from{\n" +
                        "\tcolor:black !important;\n" +
                    "}\n" +
                    ".chat-lines li[data-message*='loadingreadyrun'] {\n" +
                        "\tbackground-color: #00005d !important;\n" +
                    "}"
    }
};

initConfig();
waitForKeyElements (".chat-lines", onChatLoad);

function onChatLoad() {
    loadSettings();
    actionFunction();
}

//Creates , inits the config handler
//See https://github.com/sizzlemctwizzle/GM_config/wiki for details
function initConfig() {
    GM_config.init({
        "id" : "chat-config",
        "title" : "Nifty Chat Monitor Settings",
        "fields" : configFields,
        // I need a better way of settings this css attribute. I'm thinking of converting
        // it to a variable, because I could use new lines in that and keep it somewhere
        // out of sight, but thats for later-Jack
        "css" : "#chat-config .field_label { font-size: 32px !important; line-height: 35px !important; font-family: 'Open Sans Condensed', sans-serif !important; font-weight: normal !important; } .config_var input[type=checkbox] {  transform: scale(2.0); } #chat-config_field_CustomHighlighting { width: 90%; height: 500px; }" //adds CSS to the config page
    });
}

function loadSettings() {
    //Add settings wheel to page
    $( ".ember-chat-container").append("<div id=\"settings-wheel\"> <i class=\"material-icons\">settings</i> </div>");
    $( "#settings-wheel").click(function() {
      GM_config.open();
    });

    //Reverse messages
    if(typeof qs.reverse !== 'undefined' || GM_config.get("ReverseDirection")) {
        $( ".tse-content" ).addClass('reverse');
    }

    //Hide chat interface
    if(GM_config.get("HideChatInput")) {
        $( ".qa-chat" ).addClass("hide-chat-interface");
    }

    //Check if we should be adding inline images or not
    if(typeof qs.img !== 'undefined' || GM_config.get("InlineImages")) {
        inlineImages = true;
    }

    //Add CSS from text area
    var customHighlighting = GM_config.get("CustomHighlighting");
    var head = document.getElementsByTagName("head")[0];
    var newCss = document.createElement("style");
    newCss.type = "text/css";
    newCss.innerHTML = customHighlighting;
    head.appendChild(newCss);
}

function actionFunction() {
    // The node to be monitored
    var target = $( ".chat-lines" )[0];
    // Create an observer instance
    var observer = new MutationObserver(function( mutations ) {
        mutations.forEach(function( mutation ) {
            var newNodes = mutation.addedNodes; // DOM NodeList
            if( newNodes !== null ) { // If there are new nodes added
                var $node = $(newNodes[0]);
                if( $node.hasClass( "ember-view" ) ) {

                    //add data-user=<username> for user-based highlighting
                    $node.attr('data-user',$node.find('.from').text());

                    //add data-badges=<badges> for badge-based highlighting
                    var badges = [];
                    $node.find('.badges .badge').each(function(){
                        badges.push($(this).attr('alt'));
                    });
                    $node.attr('data-badges',badges.join(','));

                    //add data-message=<message> for keyword-based highlighting
                    $node.attr('data-message',$node.find('.message').text().replace(/(\r|\s{2,})/gm," ").trim().toLowerCase());

                    //add inline images
                    if(inlineImages) {
                        var $links = $node.find('.message a');
                        $links.each(function(i){
                            var re = /(.*(?:jpg|png|gif))$/mg;
                            if(re.test($(this).text())){
                                $(this).html('<img src="'+$(this).text()+'">');
                            }
                        });
                    }

                    //add 'odd' class for zebra striping. Checks the last 10 lines in case of chat flooding
                    $('.chat-lines > .ember-view').slice(-10).each(function(){
                        if(!$(this).prev().hasClass('odd')){
                            $(this).addClass('odd');
                        }
                    });

                }
            }
        });
    });

    // Configuration of the observer:
    var config = {
        attributes: true,
        childList: true,
        characterData: true
    };

    // Pass in the target node, as well as the observer options
    observer.observe(target, config);
}

//inject custom stylessheet
var style = GM_getResourceText('style');
GM_addStyle(style);
var materialIcons = GM_getResourceText('material-icons');
GM_addStyle(materialIcons);
