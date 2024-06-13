import express from "express"
import bodyParser from "body-parser"
import multer from "multer"
import cors from "cors"
import path from "path"
import dotenv from "dotenv"
import mongoose from "mongoose"
import brcypt from "bcrypt"
import passport from "passport"
import { Strategy as LocalStrategy } from "passport-local"
import session from "express-session"
import GoogleStrategy from "passport-google-oauth2"

const port = 4000
const saltRounds = 10
const app = express()
dotenv.config()

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
)

app.use(passport.initialize())
app.use(passport.session())

mongoose
    .connect(process.env.MONGO_URL)
    .then(console.log("Connected to DB"))
    .catch((err) => console.log(err))

const Book = mongoose.model("Book", {
    id: {
        type: Number,
        unique: true,
    },
    name: {
        type: String,
        require: true,
    },
    author: {
        type: String,
        require: true,
    },
    isbn: {
        type: Number,
        unique: true,
    },
    date: {
        type: String,
    },
    rating: {
        type: Number,
    },
    link: {
        type: String,
    },
    summary: {
        type: String,
    },
    notes: {
        type: String,
    },
    img: {
        type: String,
    },
})

const User = mongoose.model("User", {
    username: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        require: true,
    },
    book: {
        type: Object,
    },
})

app.get("/", (req, res) => {
    res.send("Working")
})
app.post("/addbook", async (req, res) => {
    console.log(req.body)
    const newBook = new Book({
        id: req.body.book.id,
        name: req.body.book.name,
        author: req.body.book.author,
        isbn: req.body.book.isbn,
        date: req.body.book.date,
        rating: req.body.book.rating,
        link: req.body.book.link,
        summary: req.body.book.summary,
        notes: req.body.book.notes,
        img: req.body.book.img,
    })
    await newBook.save()
    res.json({ success: "true", message: "Book Saved" })
    console.log("Saved new book")
})

app.get("/allbooks", async (req, res) => {
    const response = await Book.find()
    res.json(response)
})

app.post("/removebook", async (req, res) => {
    const response = await Book.findOneAndDelete({ id: req.body.bookId })
    res.json({succes:true, message:`${response.name} deleted`})
})



// MULTER STORAGE ENGINE
const storage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    },
})

const upload = multer({ storage: storage })

// UPLOAD ENDPOINT FOR IMAGE
app.use("/images", express.static("upload/images"))
app.post("/upload", upload.single("book"), (req, res) => {
    res.json({
        success: true,
        img_url: `http://localhost:${port}/images/${req.file.filename}`,
    })
})

app.post("/login", (req, res) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) {
            return res.status(500).json({ message: "Error occured in logging-in" })
        }
        if (!user) {
            return res.status(401).json({ message: info.message })
        }
        req.logIn(user, (err) => {
            if (err) {
                return res.status(500).json({ message: "Error occured while authenticating" })
            }
            return res.status(200).json({ message: req.session })
        })
    })(req, res)
})

app.post("/signup", async (req, res) => {
    const username = req.body.username
    const email = req.body.email
    const password = req.body.password

    console.log("email:", email,"Password:",password)
    try {
        const checkResult = await User.findOne({ email: email })
        if (checkResult) {
            res.json({ success:false, message: "User already registered, Please try login" })
        } else {
            brcypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.log("Error hashing password:", err)
                } else {
                    const user = new User({
                        username: username,
                        email: email,
                        password: hash,
                    })
                    await user.save()
                    console.log(`${username} saved to Users DB`)
                    req.logIn(user, (err) => {
                        if (err) {
                            return res.json({success:false, message: "Error occured in logging-in" })
                        }
                        return res.json({success:true, session: req.session })
                    })
                }
            })
        }
    } catch (error) {
        console.log(error)
    }
})

app.post('/authcheck', (req, res) => {
    console.log("hit1")
    console.log('Session:', req.session);
    console.log('User:', req.user);
    if (req.isAuthenticated()) {
        console.log("hit2")
        res.json({ authenticated: true, user: req.user });
    } else {
      res.json({ authenticated: false });
    }
  });

passport.use(
    "local",
    new LocalStrategy({ usernameField: "email" }, async function verify(email, password, cb) {
        try {
            const user = await User.findOne({ email: email })
            if (user) {
                const storedPassword = user.password
                brcypt.compare(password, storedPassword, (err, valid) => {
                    if (err) {
                        console.log("Error comparing passwords")
                        return cb(err)
                    } else {
                        if (valid) {
                            return cb(null, user)
                        } else {
                            return cb(null, false, { message: "Incorrect password" })
                        }
                    }
                })
            } else {
                return cb(null, false)
            }
        } catch (error) {
            console.log(error)
        }
    })
)

passport.serializeUser((user, cb) => {
    cb(null, user)
})
passport.deserializeUser((user, cb) => {
    cb(null, user)
})

app.listen(port, () => {
    console.log(`Port Running on http://localhost:${port}`)
})
