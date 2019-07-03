module.exports = function (RED) {
    const SpotifyWebApi = require('spotify-web-api-node');

    function SpotifyNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        node.config = RED.nodes.getNode(config.auth);
        node.api = config.api;	

        node.on('input', function (msg) {
            	handleInput(msg);
            
        });

        function handleInput(msg) {
            try {
                const credentials = RED.nodes.getCredentials(config.auth);

		const spotifyApi = new SpotifyWebApi({
            		clientId: credentials.clientId,
            		clientSecret: credentials.clientSecret,
            		accessToken: credentials.accessToken,
            		refreshToken: credentials.refreshToken
        	});

		let params = (msg.params) ? msg.params : [];
                // Reduce params to 1 less than the function expects, as the last param is the callback
                params = params.slice(0, spotifyApi[node.api].length - 1);

                spotifyApi[node.api](...params).then(data => {
                    msg.payload = data.body;
                    node.send(msg);
                }).catch(err => {
                    msg.error = err;
                    node.send(msg);
                });
            } catch (err) {
                msg.err = err;
                node.send(msg);
            }
        }
    }
    RED.nodes.registerType("spotify", SpotifyNode);

    RED.httpAdmin.get('/spotify/apis', function (req, res) {
        const nonPublicApi = [
            '_getCredential',
            '_resetCredential',
            '_setCredential',
            'authorizationCodeGrant',
            'clientCredentialsGrant',
            'createAuthorizeURL',
            'getAccessToken',
            'getClientId',
            'getClientSecret',
            'getCredentials',
            'getRedirectURI',
            'getRefreshToken',
            'refreshAccessToken',
            'resetAccessToken',
            'resetClientId',
            'resetClientSecret',
            'resetCredentials',
            'resetRedirectURI',
            'resetRefreshToken',
            'setAccessToken',
            'setClientId',
            'setClientSecret',
            'setCredentials',
            'setRedirectURI',
            'setRefreshToken'
        ];

        let response = [];
        for (let key in Object.getPrototypeOf(new SpotifyWebApi())) {
            response.push(key);
        }
        response.sort();

        response = response.filter(function (item) {
            return nonPublicApi.indexOf(item) == -1;
        });

        res.json(response);
    });
};
