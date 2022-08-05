const express = require("express");
const bcrypt = require("bcryptjs");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const { render } = require("express/lib/response");
const Schema = mongoose.Schema;

const mongoDb = "mongodb+srv://BwitterUser:BwitterPassword@bwittercluster.t90xy.mongodb.net/Bwitter?retryWrites=true&w=majority";
mongoose.connect(mongoDb, { useUnifiedTopology: true, useNewUrlParser: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "mongo connection error"));

let isLiked = false;
const port = process.env.PORT || 3000

const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    image: {type: String},
    backgroundImage:{type: String},
    accountName: {type: String},
    following: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }],
    followers: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }],
    blogPostsArr: [
                    {blogPosts: {type: mongoose.SchemaTypes.ObjectId, ref: "Blog"},
                     isRebweet: {type: Boolean}
                 }]
  })
);

const Blog = mongoose.model(
  "Blog",
  new Schema({
    post: {type: String},
    author: {type: mongoose.SchemaTypes.ObjectId, ref: "User"},
    reBweets: {type: Number},
    likeArr: [{
      likeUser: {type: mongoose.SchemaTypes.ObjectId, ref: "User"}
    }],
    reply: [{
      replyPost: {type: String},
      replyAuthor: {type: mongoose.SchemaTypes.ObjectId, ref: "User"}
    }]
  }, { timestamps: true})
);

const app = express();
app.set("view engine", "ejs");

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));

passport.use(
    new LocalStrategy((username, password, done) => {
      User.findOne({ username: username }, (err, user) => {
        if (err) { 
          return done(err);
        }
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }
        bcrypt.compare(password, user.password, (err, result) => {
          if (result) {
            // passwords match! log user in
            return done(null, user);
          } else {
            // passwords do not match!
            return done(null, false, { message: "Incorrect password" });
          }
        });
        
      });
    })
  );

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  next();
});

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/sign-up", (req, res) => {
  let usernameExists = false;
  res.render("sign-up-form", {usernameExists: usernameExists})
});

app.post("/sign-up", (req, res, next) => {

  
    // otherwise, store hashedPassword in DB
    User.findOne({username: req.body.username})
    .exec(function(err, user){
      if(user){
        let usernameExists = true;
        console.log("username already exists")
        res.render("sign-up-form", {usernameExists: usernameExists});
      }
      else{
        bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
          // if err, do something
          if(err){
            return next(err);
          }
          // otherwise, store hashedPassword in DB
          const user = new User({
            username: req.body.username,
            password: hashedPassword,
            accountName: "default",
            image: "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
            backgroundImage: ""
          }).save(err => {
            if (err) { 
              return next(err);
            }
            res.redirect("/");
            });
          });
      }
    })
    
    
  });

app.get("/failed-log-in", (req, res) => {
  res.render("failed-log-in");
})

app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/failed-log-in"
  })
);

app.get("/log-out", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/explore-page", (req, res) => {
  //READ THIS PLZ !!!!!!!! you need the whole user blog with retweet, not just blog
  //READ THE LAST TAB YOU OPENED
  /* Blog.find({})
  .exec(function (err, blog){
    let blogReverse = blog.reverse();
    let arr = [];
    User.findOne({username: req.user.username})
    .exec(function(err, currentUser) {
      blogReverse.forEach(function(blogObject) {
        if(!(currentUser.blogPostsArr.some(e => e.blogPosts.post === blogObject.post))){
          arr.push()
        }
      })
    })
  }) */
   User.find()
   .populate({
    path:"blogPostsArr.blogPosts",
    populate: {
      path: "author"
    }
  })
  .exec(function (err, user) {
    let arr = [];
    let sortedArr = [];
    let loopIteration = 0;
    User.findOne({username: req.user.username})
    .populate('blogPostsArr.blogPosts')
    .exec(function (err, currentUser) {
      user.forEach(function(userObject) {
        loopIteration = (userObject.blogPostsArr.length -1);
        //console.log(currentUser._id);
        while(loopIteration >= 0){
          //console.log(userObject.blogPostsArr[loopIteration])
          //console.log(userObject.blogPostsArr[loopIteration].blogPosts.author)
           if(userObject.blogPostsArr[loopIteration].blogPosts.author.equals(currentUser._id)){
            loopIteration--
          } 
          else if(currentUser.blogPostsArr.some(e => e.blogPosts.post === userObject.blogPostsArr[loopIteration].blogPosts.post)){
            loopIteration--
          }
          /* else if(arr.length === 0){
            //console.log(userObject.blogPostsArr[loopIteration])
            arr.push(userObject.blogPostsArr[loopIteration]);
            loopIteration--
            
          } */
          else {
             if(arr.some(e => e.blogPosts.post === userObject.blogPostsArr[loopIteration].blogPosts.post)){
              //console.log(userObject.blogPostsArr[loopIteration])
              loopIteration--;
            }
             else if(arr.some(e => userObject.blogPostsArr[loopIteration].blogPosts.author.equals(e.blogPosts.author))){
              loopIteration--;
            }
             else if(!(userObject.blogPostsArr[loopIteration].blogPosts.author.equals(userObject._id))){
              loopIteration--;
             } 
            else{
              arr.push(userObject.blogPostsArr[loopIteration]);
              //console.log(userObject.blogPostsArr[loopIteration])
              loopIteration--;
              
            }
          }
        }
      })
      
      sortedArr = arr.sort((a,b) => (a.blogPosts.createdAt < b.blogPosts.createdAt) ? 1 : -1);
      console.log("-----------------------------------------")
      let someUsers = user.filter(randomUser => (!(currentUser.following.includes(randomUser._id)) && !(randomUser._id.equals(currentUser._id)) && !(currentUser.followers.includes(randomUser._id))));
      let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
      let usersToFollow = shuffledUsers.slice(0, 3);
      res.render("explore-page", {blogs: sortedArr, thisUser: currentUser, usersToFollow: usersToFollow});
    });
    }) 
    
});

app.post("/ReBweet/:id", (req, res) => {
  Blog.findOne({_id: req.params.id})
  .exec(function(err, blog) {
    if(err){
      console.log(err)
    }
    else{
      console.log("-------------------------------------------")
      let reBweetAmount = blog.reBweets;
      reBweetAmount++;
      blog.reBweets = reBweetAmount;
      blog.save();
      User.findOne({username: req.user.username})
      .exec(function (err, user) {
        if(err){
          console.log(err)
        }
        else{
          let blogPostObject = {blogPosts: blog._id,
                                isRebweet: true}
          user.blogPostsArr.push(blogPostObject);
          user.save();
          res.redirect('back');
        }
      })
    }
  })
})

app.post("/like/:id", (req, res) => {
  //do a for each on the ejs for the css like animation
  const id = req.params.id;
  User.findOne({username: req.user.username})
  .exec(function (err, user) {
    if(err){
      console.log(err)
    }
    else{
      Blog.findById({_id: id})
      .exec(function(err, blog) {
        if(err){
          console.log(err)
        }
        //use the some arr function to see if arr contains variable
        else{
          if(blog.likeArr.some(e => user._id.equals(e._id))){
            Blog.updateOne({_id: id}, 
              {$pull: {likeArr: {_id: user._id}}})
              .exec(function(err, theBlog){
                res.redirect('back');
              })
          }
          
          else{
            blog.likeArr.push(user._id);
            blog.save()
            res.redirect('back');
          }
        }
      })
    }
  })
})

app.get("/homepage", (req, res) => {
  User.findOne({username: req.user.username})
  //.populate("blogPostsArr.blogPosts")
  .populate({
    path:"blogPostsArr.blogPosts",
    populate: {
      path: "author"
    }
  })
  .exec(function (err, user) {
    if(err){
      console.log(err)
    }
    else{
      User.find()
      .exec(function(err, randomUsers) {
        let someUsers = randomUsers.filter(randomUser => (!(user.following.includes(randomUser._id)) && !(randomUser._id.equals(user._id)) && !(user.followers.includes(randomUser._id))));
        let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
        let usersToFollow = shuffledUsers.slice(0, 3);
        let reversedBlogsArray = user.blogPostsArr.reverse();
        res.render("homepage", {blogs: reversedBlogsArray, user: user, usersToFollow: usersToFollow});
      })
    }
  })
});

app.get("/otherHomepage/:id", (req, res) => {
  const id = req.params.id;
  User.findById(id)
  .populate({
    path:"blogPostsArr.blogPosts",
    populate: {
      path: "author"
    }
  })
  .exec(function(err, user) {
    if(err){
      console.log(err)
    }
    else{
      let reversedBlogsArray = user.blogPostsArr.reverse();
      User.findOne({username: req.user.username})
      .exec(function (err, thisUser) {
        if(err){
          console.log(err)
        }
        else{
          User.find()
          .exec(function(err, randomUsers) {
          let someUsers = randomUsers.filter(randomUser => (!(user.following.includes(randomUser._id)) && !(randomUser._id.equals(user._id)) && !(user.followers.includes(randomUser._id))));
          let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
          let usersToFollow = shuffledUsers.slice(0, 3);
          let reversedBlogsArray = user.blogPostsArr.reverse();
          res.render("otherHomepage", {blogs: reversedBlogsArray, user: user, thisUser: thisUser, usersToFollow: usersToFollow});
          })
        }
      })
    }
  })
})

app.post("/delete/:id", (req, res) => {
  const id = req.params.id;

   User.findOne({username: req.user.username})
  .exec(function (err, user) {
    Blog.findOne({_id: id})
    .exec(function(err, blog) {
      if(blog.author.equals(user._id)){
        User.updateMany({
          blogPostsArr: {
            $elemMatch: {blogPosts: id}
        }}, {$pull: {blogPostsArr: {blogPosts: id}}})
        .exec(function(err, updatedUser) {
          Blog.findByIdAndDelete(id)
          .exec(function (err, deletedBlog) {
            res.redirect('back');
          });
        })
        console.log("deleting now")
      }
      else {
        console.log("not author")
        User.findOneAndUpdate({username: req.user.username}, {$pull: {blogPostsArr: {blogPosts: id}}})
        .exec(function(err, noneAuthorUser) {
          let reBweetAmount = blog.reBweets;
          reBweetAmount--;
          blog.reBweets = reBweetAmount;
          blog.save();
          res.redirect('back');
        })
      }
    })
  }) 
})

app.post("/deleteReply/:id", (req, res) => {
  const id = req.params.id;
  Blog.findOneAndUpdate({
    reply: {
      $elemMatch: {_id: id}
    }
  }, {$pull: {reply: {_id: id}}})
  .populate("reply.replyAuthor")
  .exec(function(err, blog) {
   res.redirect(`/post/${blog._id}`)
  })
})

app.get("/post/:id", (req, res) => {
  const id = req.params.id;
  Blog.findById(id)
  .populate("reply.replyAuthor")
  .populate("author")
  .then(result => {
    User.findOne({username: req.user.username})
    .exec(function(err, user) {
      User.find()
      .exec(function(err, randomUsers) {
        let someUsers = randomUsers.filter(randomUser => (!(user.following.includes(randomUser._id)) && !(randomUser._id.equals(user._id)) && !(user.followers.includes(randomUser._id))));
        let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
        let usersToFollow = shuffledUsers.slice(0, 3);
        res.render('post', {blogs: result, user: user, usersToFollow: usersToFollow})
      })
    })
  })
  .catch(err => {
    console.log(err);
  });
});

app.post("/post/:id", (req, res) => {
  const id = req.params.id;
  User.findOne({username: req.user.username})
  .exec(function(err, user){
    let update = {replyPost: req.body.reply,
      replyAuthor: user._id};
      Blog.findById(id)
      .exec(function (err, blog) {
        blog.reply.push(update)
        blog.save()
        res.redirect(`/post/${id}`)
      })
  })
  
})

app.get("/create-post", (req, res) => {
  User.findOne({username: req.user.username})
  .exec(function(err, user) {
    if(err){
      console.log(err)
    }
    else{
      User.find()
      .exec(function(err, randomUsers) {
        let someUsers = randomUsers.filter(randomUser => (!(user.following.includes(randomUser._id)) && !(randomUser._id.equals(user._id)) && !(user.followers.includes(randomUser._id))));
        let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
        let usersToFollow = shuffledUsers.slice(0, 3);
        res.render("create-post", {user: user, usersToFollow: usersToFollow});
      })
    }
  })
});

app.post("/create-post", (req, res) => {
  
    User.findOne({username: req.user.username}, (err, user) => {
      const blog = new Blog({
        post: req.body.post,
        author: user._id,
        reBweets: 0
      });
      blog.save(err => {
          if (err) { 
            return next(err);
          }
        });
         user.blogPostsArr.push({
          blogPosts: blog._id,
          isRebweet: false
         });
         user.save();
         res.redirect("/homepage");
       });
    });

app.post("/follow/:id", (req, res) => {
  const id = req.params.id;

  User.findOne({username: req.user.username})
  .exec(function(err, currentUser){
    if (err) { 
      return next(err);
    }
     else {
       User.findById(id)
       .exec(function(err, user) {
          if(currentUser.following.some(e => user._id.equals(e._id))){
            console.log("deleting")
            User.updateOne({username: req.user.username}, 
            {$pull: {following: mongoose.Types.ObjectId(user._id)}})
             .exec(function (err, updatedCurrentUser) {
              User.updateOne({_id: id},
               {$pull: {followers: mongoose.Types.ObjectId(currentUser._id)}})
               .exec(function() {
                 console.log("finished")
                  res.redirect('back')
                })
            })
              /* let tempArr1 = currentUser.following.filter(userFollowing => 
                userFollowing._id !== user._id)
              currentUser.following = tempArr1;

              let tempArr2 = user.followers.filter(userFollower => 
                userFollower._id !== currentUser._id)
              user.followers = tempArr2;
              currentUser.save()
              user.save()
              res.redirect('back'); */
         }
        else{
          currentUser.following.push(id)
           user.followers.push(currentUser._id)
           currentUser.save()
           user.save()
           res.redirect('back');
          }
      })
    }
  })
})

app.get("/followers/:id", (req, res) => {
  const id = req.params.id;
  User.findById(id)
  .populate("followers")
  .exec(function(err, user){
    if(err){
      console.log(err)
    }
    else{
      User.findOne({username: req.user.username})
      .exec(function(err, thisUser){
        User.find()
        .exec(function(err, randomUsers) {
          let someUsers = randomUsers.filter(randomUser => (!(thisUser.following.includes(randomUser._id)) && !(randomUser._id.equals(thisUser._id)) && !(thisUser.followers.includes(randomUser._id))));
          let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
          let usersToFollow = shuffledUsers.slice(0, 3);
          res.render("followers", {user: user, thisUser: thisUser, usersToFollow: usersToFollow})
      })
      })
    }
  })
})

app.get("/following/:id", (req, res) => {
  const id = req.params.id;
  User.findById(id)
  .populate("following")
  .exec(function(err, user){
    if(err){
      console.log(err)
    }
    else{
      User.findOne({username: req.user.username})
      .exec(function(err, thisUser){
        User.find()
        .exec(function(err, randomUsers) {
          let someUsers = randomUsers.filter(randomUser => (!(thisUser.following.includes(randomUser._id)) && !(randomUser._id.equals(thisUser._id)) && !(thisUser.followers.includes(randomUser._id))));
          let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
          let usersToFollow = shuffledUsers.slice(0, 3);
          res.render("following", {user: user, thisUser: thisUser, usersToFollow: usersToFollow});
        })
      })
    }
  })
})

app.get("/change-accountName", (req, res) => {
  User.findOne({username: req.user.username})
  .exec(function(err, user){
    if(err){
      console.log(err)
    }
    else{
      User.find()
      .exec(function(err, randomUsers) {
        let someUsers = randomUsers.filter(randomUser => (!(user.following.includes(randomUser._id)) && !(randomUser._id.equals(user._id)) && !(user.followers.includes(randomUser._id))));
        let shuffledUsers = someUsers.sort(() => 0.5 - Math.random());
        let usersToFollow = shuffledUsers.slice(0, 3);
        res.render("change-accountName", {user: user, usersToFollow: usersToFollow});
      })
    }
  })
}); 

app.post("/change-accountName", (req, res) => {
  User.findOne({username: req.user.username})
  .exec(function(err, user){
    if(err){
      console.log(err)
    }
    else{
      user.accountName = req.body.accountName;
      user.save();
      res.redirect("/homepage")
    }
  })
})

app.listen(port, () => console.log("app listening on port 3000!"));