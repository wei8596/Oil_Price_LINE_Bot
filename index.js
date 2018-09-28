const cheerio = require('cheerio');
const express = require('express');
const https = require('https');
const moment = require('moment');
const linebot = require('linebot');
const request = require('request');
const rp = require('request-promise');

const myUrl = 'https://cw-linebot.herokuapp.com';
const gasUrl = 'https://gas.goodlife.tw';
const SITE_NAME = '新竹';

// AQI空氣品質網站連線請求參數
const aqiOpt = {
  uri: 'http://opendata2.epa.gov.tw/AQI.json',
  json: true
};

var users = [];

// 星期
var week = moment().utc().utcOffset(+8).format('ddd');
// 時間(小時)
var time = moment().utc().utcOffset(+8).format('hA');

var aqiSites = [];

// pings my heroku app every 25 mins
// (app will go to sleep after an hour of inactivity)
setInterval(function() {
  https.get(myUrl);
}, 1500000); // 25 mins

function readAQI(repos) {
  let data;

  for(i in repos) {
	if(repos[i].SiteName == SITE_NAME) {
      data = repos[i];
      break;
    }
  }

  // 傳回觀測站的空氣品質(JSON格式)
  return data;
};

const app = express();
// 使用ejs樣板引擎
app.set('view engine', 'ejs');
// 處理網站首頁的請求
app.get('/', function(req, res) {
  rp(aqiOpt) // 取得空氣品質資料
  .then(function(repos) {
    res.render('index', {AQI:readAQI(repos)});
  })
  .catch(function(err) {
    res.send('Cannot request AQI data');
  });
});

// 建立linebot物件
const bot = linebot({
  channelId: process.env.CHANNEL_ID,					// 頻道識別碼
  channelSecret: process.env.CHANNEL_SECRET,			// 頻道密鑰
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN	// 頻道存取碼
});

// Create Express.js middleware to parse the request.
// 驗證數位簽章並解析JSON資料
const linebotParser = bot.parser();
// 處理LINE訊息伺服器的請求
app.post('/', linebotParser);

// LineBot.on(eventType, eventHandler)
// Raised when a Webhook event is received.

// 有人傳送訊息給LineBot時, 處理回應
bot.on('message', function(event) {
  switch(event.message.type) {
    case 'text':
      switch(event.message.text) {
        case 'wei.bot':
          // Get user profile information of the sender.
          event.source.profile().then(function(profile) {
            event.reply('Hi ' + profile.displayName +
            '\n可以試試以下關鍵字喔！' +
            '\n【wei.bot】：和我打招呼,' +
            '\n【空氣】：空氣品質狀態,' +
            '\n【油價】：即時與預計油價.' +
            '\n[油價通知]：由於仍在開發階段，' +
            '\n\t需與管理者聯絡，開通此功能.');
          });
          console.log('id: ', event.source.userId);
          break;
        case '空氣':
          let data;

          rp(aqiOpt)
          .then(function(repos) {
            data = readAQI(repos);
            event.reply(data.County + '-' + data.SiteName + '測站' +
                        '\n\n空氣品質指標(AQI)：' + data.AQI +
                        '\n狀態：' + data.Status +
                        '\n\n空氣品質指標(AQI)與健康影響：' +
                        '\n\t\t\t0～50\t：良好' +
                        '\n\t\t51～100：普通' +
                        '\n\t101～150：對敏感族群不健康' +
                        '\n\t151～200：對所有族群不健康' +
                        '\n\t201～300：非常不健康' +
                        '\n\t301～500：危害' +
                        '\n\n發布時間：' + data.PublishTime +
                        '\n(資料每小時更新)');
          })
          .catch(function(err) {
            event.reply('請求空氣品質資料時發生問題了~');
          });
          break;
        case '油價':
          request.get(gasUrl, function(err,res,data) {
            $ = cheerio.load(data); // cheerio載入html內文, 並儲存至data
            //console.log($('.main').text());
			//console.log($('.main P').text()); // 下週一2018年08月20日起,預計汽油每公升:
            //console.log($('.main h2').text(); // 漲跌值
            var predprice = '\n\n' + $('.main P').text() + $('.main h2').text();
            //console.log(predprice);
            var NewArray = new Array();
            // 讀取中油, 台塑 油價資訊, replace(/\s+/g,'')去除空白字串
            var string = $('#cpc').text().replace(/\s+/g,'');
            var NewArray = string.split('今日台塑油價');
            var cpcprice = NewArray[0].replace(/油價/, '').replace(/92:/, '\n92 : ').replace(/95油價:/, '\n95 : ').replace(/98:/, '\n98 : ').replace(/柴油:/, '\n柴油 : ');
            //console.log(cpcprice);
            var fpcprice = '\n\n今日台塑' + '' + NewArray[1].replace(/92:/, '\n92 : ').replace(/95油價:/, '\n95 : ').replace(/98:/, '\n98 : ').replace(/柴油:/, '\n柴油 : ');
            //console.log(fpcprice);
            event.reply(cpcprice + fpcprice + predprice +
            '\n(中油每週日中午公佈明日油價)');
          });
          break;
        default:
          break;
      }
      break;
    case 'image':
      // Get image data sent by users as a Buffer object.
      event.message.content().then(function(data) {
        return event.reply('Nice picture!');
      }).catch(function(err) {
        return event.reply(err.toString());
      });
      break;
    default:
      break;
  }
});

// 加入好友
bot.on('follow', function(event) {
  event.reply('哈囉！我是wei.bot' +
            '\n可以試試以下關鍵字喔！' +
            '\n【wei.bot】：和我打招呼,' +
            '\n【空氣】：空氣品質狀態,' +
            '\n【油價】：即時與預計油價.' +
            '\n[油價通知]：由於仍在開發階段，' +
            '\n\t需與管理者聯絡，開通此功能.');
  console.log('follow:', event.source.userId);
  // get user profile displayName
  event.source.profile().then(function(profile) {
    console.log(profile.displayName);
  });
});

bot.on('unfollow', function(event) {
  console.log('unfollow:', event.source.userId);
  // get user profile displayName
  event.source.profile().then(function(profile) {
    console.log(profile.displayName);
  });
});

// 加入群組
bot.on('join', function(event) {
  event.reply('哈囉！我是wei.bot' +
            '\n輸入wei.bot認識我' +
            '\n歡迎加我好友，成為你的小助手:)');
  console.log('join:', event.source.groupId);
});

// 退出群組
bot.on('leave', function(event) {
  console.log('leave:', event.source.groupId);
});

// 若環境變數沒有定義PORT, 設為8080
app.listen(process.env.PORT || 8080, function() {
  console.log('Running on port', this.address().port);

  // 每週日下午一點自動發送下週油價給使用者
  if(week === 'Sun' && time === '1PM') {
	request.get(gasUrl, function(err,res,data) {
      $ = cheerio.load(data); // cheerio載入html內文, 並儲存至data
      var predprice = $('.main P').text() + $('.main h2').text();
      for(let index in users) {
        let id = users[index];
        bot.push(id, predprice);
        }
    });
  }
});
