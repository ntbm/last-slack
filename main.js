var request = require("request"),
	commander = require("commander"),
	config = require("./config.json"),
	currentTrack;

function fetchLastPlayedTrack(username, callback) {
	var url = "http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks" +
			"&user=" + username +
			"&api_key=" + config.lastfm.apiKey +
			"&format=json",
		data,
		track;

	request(url, function (error, response, body) {
		if (error) {
			console.error(error);
		} else if (response.statusCode != 200) {
			console.error("Unhandled response type:", response.statusCode);
		} else {
			try {
				data = JSON.parse(body);
				if (data.recenttracks && data.recenttracks.track) {
					track = data.recenttracks.track;

					if (Array.isArray(track)) {
						track = track[0];
					}

					if (callback) {
						callback(track);
					} else {
						console.log(track);
					}
				} else if (data.error && data.message) {
					console.error(data.message)
				} else {
					console.error("Unrecognized data", data);
				}

				setTimeout(function () {
					fetchLastPlayedTrack(username, checkIfTrackIsPlayingAndNew);
				}, 10000);
			} catch (e) {
				console.error(e, body);
			}
		}
	});
}

function checkIfTrackIsPlayingAndNew(track) {
	var trackName;

	if (track.hasOwnProperty("@attr") &&
		track["@attr"].nowplaying &&
		"true" == track["@attr"].nowplaying) {
		trackName = "\"" + track.name + "\" by " + track.artist["#text"];

		if (currentTrack != trackName) {
			if(!config.flags.spotify){
                console.log(trackName);
			    if (!commander.quiet) {
				    sendMessageToSlack(trackName);
			    }
            }else{
                findSpotifyLink(track, function(link){
                    console.log(trackName + "\n"+ link);
                    if(!commander.quiet){
                        sendMessageToSlack(trackName + "\n"+ link);
                    }
                })
            }
			currentTrack = trackName;
		}
	}
}
function findSpotifyLink(track, cb){
    var s = track.name.replace("&", " and ").replace(" ", "+") + "+" + track.artist["#text"].replace("&"," and ").replace(" ", "+");
    var url = "https://api.spotify.com/v1/search?type=track&limit=1&q=" + s 
    request(url, function(error, response, body){
        if(!error && response.statusCode == 200){
            data = JSON.parse(body);
            if(data.tracks.items.length != 0){
                cb(data.tracks.items[0].external_urls.spotify)
            }else{
                cb('')
            }
        }else{
            cb('')
        }
    })   
}

function sendMessageToSlack(message) {
	var payload = {
			text: message,
			username: config.slack.username,
			icon_emoji: config.slack.icon
		},
		url = config.slack.url;

		request.post({
			url: url,
			form: { payload: JSON.stringify(payload) }
		}, function(error, response, body) {
			if (error) {
				console.error(error);
			} else if (response.statusCode != 200) {
				console.error("Unhandled response type:", response.statusCode);
			}
		});
}

// Parse args
commander
	.version("1.0.0")
	.usage("[options] <username>")
	.option("-q, --quiet", "Don't send message to Slack")
	.parse(process.argv);

if (!commander.args.length) {
	commander.help();
}

fetchLastPlayedTrack(commander.args[0], checkIfTrackIsPlayingAndNew);
