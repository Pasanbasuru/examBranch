var User = require('../models/user');
var Story = require('../models/story');
var config = require('../../config');

var secretKey = config.secretKey;

var jsonwebtoken = require('jsonwebtoken');

function createToken(user){

	var token = jsonwebtoken.sign({
		id: user._id,
		name: user.name,
		username: user.username
	}, secretKey, {
		expiresIn : 60*60*24
	});

	return token;
} 

module.exports = function(app, express, io){

	var api = express.Router();

	api.get('/all_stories', function(req, res){
		Story.find({}, function(err, stories){
			if(err){
				res.send(err); 
				return;
			}
			res.json(stories);
		});
	});

	api.post('/signup', function(req,res){
		//console.log(req.body);
		var user = new User({
			name: req.body.name,
			username: req.body.username,
			password: req.body.password
		});

		var token = createToken(user);
 
		//console.log(user);
		user.save(function(err){
			if(err){
				//console.log(err);
				res.send(err);
				return;
			}

			res.json({ 
				success: true,
				message: 'User has been created!',
				token: token
			});
		});
	});

	api.get('/users',function(req,res){
		
		User.find({}, function(err,users){
			if(err){
				res.send(err);
				return
			}

			res.json(users);
		});
	});

	api.post('/login',function(req,res){

		User.findOne({ 
			username: req.body.username
		}).select('name username password').exec(function(err, user){
			if(err) throw err;

			if(!user){
				res.send({ message : "user does not exist"});
			} else if(user){

				var validPassword = user.comparePassword(req.body.password);

				if(!validPassword){
					res.send({ message: "invalid Password"});
				}else{

					var token = createToken(user);

					res.json({
						success: true,
						message: "successfuly login!",
						token: token
					});
				}
			}

		});
	});

	api.use(function(req,res,next){

		console.log('someone came');

		var token = req.body.token || req.param('token') || req.headers['x-access-token'];

		//checking token exists
		
		if(token){
			
			jsonwebtoken.verify(token, secretKey, function(err, decoded){

				if(err){
					console.log("err is here");
					res.status(403).send({ success: false, message: "failed to authenticate"});

				}else{

					req.decoded = decoded;

					next();
				}
			});
		}else{

			res.status(403).send({ success: false, message:"no token provided"});
		}
	});

	//home page

	api.route('/')

		.post(function(req, res){
			//console.log('call emit');
			var story = new Story({
				creator: req.decoded.id,
				content: req.body.content
			});

			story.save(function(err, newStory){
				if(err){
					res.send(err);
					return
				}
				  
				io.emit('story',newStory);
				res.json({ message: "new story added!"});
			});
		}) //dont put semicolon if wanna do chaining methods(both get and post)

		.get(function(req, res){

			Story.find({ creator: req.decoded.id }, function(err,stories){
				if(err){
					res.send(err);
					return;
				}
				res.json(stories);
			});

		});


	//to fetching userdata separately
	api.get('/me',function(req,res){
		res.json(req.decoded);
	});

	return api
} 