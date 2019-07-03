module.exports = function (RED) {

    const url = require('url');
    const crypto = require('crypto');
    const SpotifyWebApi = require('spotify-web-api-node');

    function AuthNode(config) {
        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.scope = config.scope;

	const ID = this.id;
	
	const creds = RED.nodes.getCredentials(ID);

	if(!creds.interval){
		const interval = setInterval(function(interval) {
			try {
				const credentials = RED.nodes.getCredentials(ID);
		
				const spotifyApi = new SpotifyWebApi({
					clientId: credentials.clientId,
					clientSecret: credentials.clientSecret,
					redirectUri: credentials.callback
		        	});
				
				// Set the access token and refresh token
				spotifyApi.setAccessToken(credentials.accessToken);
				spotifyApi.setRefreshToken(credentials.refreshToken);  
		
				// Refresh token and print the new time to expiration.
		    		spotifyApi.refreshAccessToken().then(function(data) {
		        		RED.log.info(RED.log._('SpotifyAPI - Refreshed token'));
					credentials.accessToken = data.body.access_token;
		            		credentials.expireTime = data.body.expires_in + Math.floor(new Date().getTime() / 1000);
		
					RED.log.info(RED.log._('SpotifyAPI - Access token is ' + credentials.accessToken));
					RED.log.info(RED.log._('SpotifyAPI - Expire time is ' + data.body.expires_in));
					RED.nodes.addCredentials(ID, credentials);
		      		},
		      		function(err) {
					RED.log.error(RED.log._('SpotifyAPI - Could not refresh the token!' + err.message));        
	      			});
			} catch (err) {
	                	RED.log.error(RED.log._('SpotifyAPI - ' + err));
				clearInterval(interval);
	            	}
		}, 1200000);
		
		creds.interval = String(interval);
		RED.nodes.addCredentials(ID, creds);
    	}
    }

    RED.nodes.registerType("spotify-auth", AuthNode, {
        credentials: {
            name: { type: 'text' },
            clientId: { type: 'password' },
            clientSecret: { type: 'password' },
            accessToken: { type: 'password' },
            refreshToken: { type: 'password' },
            expireTime: { type: 'password' },
	    interval: { type: 'password' }
        }
    });

    RED.httpAdmin.get('/spotify-credentials/auth', function (req, res) {
        if (!req.query.clientId || !req.query.clientSecret ||
            !req.query.id || !req.query.callback) {
            res.send(400);
            return;
        }

        const node_id = req.query.id;
        const credentials = {
            clientId: req.query.clientId,
            clientSecret: req.query.clientSecret,
            callback: req.query.callback
        };
        const scope = req.query.scope;
        const csrfToken = crypto.randomBytes(18).toString('base64').replace(/\//g, '-').replace(/\+/g, '_');
        credentials.csrfToken = csrfToken;

        res.redirect(url.format({
            protocol: 'https',
            hostname: 'accounts.spotify.com',
            pathname: '/authorize',
            query: {
                client_id: credentials.clientId,
                response_type: 'code',
                redirect_uri: credentials.callback,
                state: node_id + ':' + csrfToken,
                show_dialog: true,
                scope: scope
            }
        }));
        RED.nodes.addCredentials(node_id, credentials);
    });

    RED.httpAdmin.get('/spotify-credentials/auth/callback', function (req, res) {
        if (req.query.error) {
            return res.send('spotify.query.error', { error: req.query.error, description: req.query.error_description });
        }

        const state = req.query.state.split(':');
        const node_id = state[0];
        const credentials = RED.nodes.getCredentials(node_id);

        if (!credentials || !credentials.clientId || !credentials.clientSecret) {
            return res.send('spotify.error.no-credentials');
        }
        if (state[1] !== credentials.csrfToken) {
            return res.send('spotify.error.token-mismatch');
        }

        const spotifyApi = new SpotifyWebApi({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: credentials.callback
        });
	
        spotifyApi.authorizationCodeGrant(req.query.code).then(data => {
	    credentials.accessToken = data.body.access_token;
            credentials.refreshToken = data.body.refresh_token;
            credentials.expireTime = data.body.expires_in + Math.floor(new Date().getTime() / 1000);
            credentials.tokenType = data.body.token_type;
            credentials.name = 'Spotify OAuth2';

            delete credentials.csrfToken;
            delete credentials.callback;
            RED.nodes.addCredentials(node_id, credentials);
            res.send('spotify.authorized');
            RED.log.info(RED.log._('SpotifyAPI - Access token is ' + credentials.accessToken));
            RED.log.info(RED.log._('SpotifyAPI - Refresh token is ' + credentials.refreshToken));
            RED.log.info(RED.log._('SpotifyAPI - Expire time is ' + data.body.expires_in));
        })
        .catch(error => {
            res.send('spotify.error.tokens');
        });
    });
};
