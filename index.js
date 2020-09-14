//original script by Fatema Okahabi 
const path = require("path");
const express = require('express');
const app = express();
morgan = require('morgan');
bodyParser = require('body-parser');
uuid = require('uuid');
const mongoose = require('mongoose');
const Models = require('./models.js');
// const Movies = Models.Movie;
const Locations = Models.Location;
const Users = Models.User;
const passport = require('passport');
require('./passport'); //local passport file
const cors = require('cors');
const { check, validationResult } = require('express-validator');

mongoose.connect('mongodb://localhost:27017/spinnerDb', { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });
// var allowedOrigins = ['http://localhost:8080', 'http://localhost:1234', 'https://spinner-project.herokuapp.com'];

//middleware.
app.use(cors({
  origin: function (origin, callback) {
    console.log(origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) { // If a specific origin isn’t found on the list of allowed origins
      var message = 'The CORS policy for this application doesn’t allow access from origin ' + origin;
      return callback(new Error(message), false);
    }
    return callback(null, true);
  }
}));

app.use(bodyParser.json());

var auth = require('./auth')(app);

app.use(morgan('common'));

app.use(express.static('public'));
app.use("/client", express.static(path.join(__dirname, "client", "dist")));

app.get("/client/*", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//introductory message on opening API with no url endpoint specified
app.get('/', function (req, res, next) {
  res.send('Fáilte go Spinner!');
  next();
});

//LOGÁNTA --- gets all locations
app.get("/log", passport.authenticate('jwt', { session: false }), function (req, res) {
  Locations.find()
    .then(function (locations) {
      res.status(200).json(locations);
    }).catch(function (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    });
});

//gets a specific location's information by searching its title name
app.get('/locations/:Title', passport.authenticate('jwt', { session: false }), function (req, res) {
  Locations.findOne({ Title: req.params.Title })
    .then(function (location) {
      if (!location) {
        res.status(404).send(req.params.Title + " níor aimsíodh ceantar ar an ainm sin...");
      } else {
        res.json(location)
      }
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    });
});
//gets an update of location's status. descripton by searching a genre name
//https://docs.mongodb.com/manual/tutorial/query-embedded-documents/
app.get('/locations/status/:Name', passport.authenticate('jwt', { session: false }), function (req, res) {
  Locations.findOne({ 'Status.Name': req.params.Name })
    .then(function (status) {
      if (!status) {
        res.status(404).send(req.params.Name + "deabhail rud anseo go fóil...");
      } else {
        res.json(status.Status)
      }
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error:" + err);
    });
});

//gets basic info about a location's Taoiseach upon searching their name
app.get('/locations/Taoiseach/:Name', passport.authenticate('jwt', { session: false }), function (req, res) {
  Location.findOne({ 'Taoiseach.Name': req.params.Name })
    .then(function (taoiseach) {
      if (!taoiseach) {
        res.status(404).send(req.params.Name + " Níl Taoiseach i gceanais ar an ceantar seo.");
      } else {
        res.json(taoiseach.Taoiseach)
      }
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error:" + err);
    });
});

//USERS --- get all users
app.get('/users', passport.authenticate('jwt', { session: false }), function (req, res) {

  Users.find()
    .then(function (users) {
      res.status(200).json(users)
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    });
});

//gets a user by username
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), function (req, res) {
  Users.findOne({ Username: req.params.Username })
    .then(function (user) {
      if (!user) {
        res.status(404).send(req.params.Username + " Níór aimsíodh an imreoir sin!");
      } else {
        res.status(200).json(user)
      }
    })
    .catch(function (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    });
});

//add new user - required fields = username, password, email and Birthday
app.post('/users',
  [check('Username', 'Username requires at least 8 characters.').isLength({ min: 8 }),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('Password', 'Password is required').not().isEmpty(),
  check('Email', 'Email does not appear to be valid').isEmail()],
  function (req, res) {
    // check the validation object for errors
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    var hashedPassword = Users.hashPassword(req.body.Password);
    Users.findOne({ Username: req.body.Username })
      .then(function (user) {
        if (user) {
          return res.status(400).send(req.body.Username + "already exists");
        } else {
          Users
            .create({
              Username: req.body.Username,
              Password: hashedPassword,
              Email: req.body.Email,
              DOB: req.body.DOB
            })
            .then(function (user) { res.status(201).json(user) })
            .catch(function (error) {
              console.error(error);
              res.status(500).send("Error: " + error);
            })
        }
      }).catch(function (error) {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  });

//allows user to update their information
app.put('/users/:Username', passport.authenticate('jwt', { session: false }),

  function (req, res) {
    if (req.user.Username === req.params.Username) {
      Users.findOne({ Username: req.params.Username })
        .then(function (user) {
          if (!user) {

            res.status(404).send("níor aimsíodh" + req.params.Username);
          }
          else {
            const updatedUser = {
              Username: req.body.Username || user.Username,
              Password: req.body.Password ? Users.hashPassword(req.body.Password) : user.Password,
              Email: req.body.Email || user.Email,
              DOB: req.body.DOB || user.DOB
            }

            console.log(updatedUser)
            Users.findOneAndUpdate({ _id: user._id }, {
              $set:
                updatedUser
            },
              { new: true }, // This line makes sure that the updated document is returned
              function (err, updatedUser) {
                console.log(err, updatedUser)
                if (err) {
                  console.error(err);
                  res.status(500).send("Error: " + err);
                } else {
                  res.status(200).json(updatedUser)
                }
              })
          }
        })
        .catch(function (err) {
          console.error(err);
          res.status(500).send("Error: " + err);
        });
    }
    else {
      return res.status(403).send(req.params.Username + " Ní feidir.");
    };
  });

//delete existing user (deregistration)
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), function (req, res) {
  if (req.user.Username === req.params.Username) {
    Users.findOneAndRemove({ Username: req.params.Username })
      .then(function (user) {
        if (!user) {
          res.status(404).send("Níor aimsíodh "+req.params.Username );
        } else {
          res.status(200).send(req.params.Username + "bainnte.");
        }
      })
      .catch(function (err) {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
  else {
    return res.status(403).send(req.params.Username + " Ní feidir.");
  };
});

//FAVOURITES --- adds movies to favourites, prevents duplicates of the same movie being added to the favourites.
app.post('/users/:Username/Movies/:MovieID', passport.authenticate('jwt', { session: false }), function (req, res) {
  if (req.user.Username === req.params.Username) {
    Users.findOneAndUpdate({ Username: req.params.Username }, {
      $addToSet: { FavouriteMovies: req.params.MovieID }
    },
      { new: true }, // This line makes sure that the updated document is returned
      function (err, updatedUser) {
        if (err) {
          console.error(err);
          res.status(500).send("Error: " + err);
        } else {
          res.status(201).json(updatedUser)
        }
      })
  }
  else {
    return res.status(403).send(req.params.Username + "Ní feidir.");
  };
});

//deletes a county from user's developing list
app.delete('/users/:Username/Movies/:MovieID', passport.authenticate('jwt', { session: false }), function (req, res) {
  if (req.user.Username === req.params.Username) {
    Users.findOneAndUpdate({ Username: req.params.Username }, {
      $pull: { ChampionOf: req.params.LocationID }
    },
      { new: true }, // This line makes sure that the updated document is returned
      function (err, updatedUser) {
        if (err) {
          console.error(err);
          res.status(500).send("Error: " + err);
        } else {
          return res.status(200).json(updatedUser)
        }
      })
  }
  else {
    return res.status(403).send(req.params.Username + " Ní feidir");
  };
});

//documentation


var port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", function () {
  console.log(`Ag Éisteacht ar ${port}`);
});