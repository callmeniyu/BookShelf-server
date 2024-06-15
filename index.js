import express from "express"
import bodyParser from "body-parser"
import multer from "multer"
import cors from "cors"
import path from "path"
import dotenv from "dotenv"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import brcypt from "bcrypt"

const port = 4000
const saltRound = 10
const app = express()
dotenv.config()

app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

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
    res.json({ succes: true, message: `${response.name} deleted` })
})

app.post("/signup", async (req, res) => {
    try {
        const username = req.body.formData.email
        const email = req.body.formData.email
        const password = req.body.formData.password

        const checkUser = await User.findOne({ email: email })
        if (checkUser) {
            res.json({ success: false, message: "User already exists, please try login" })
        } else {
            brcypt.hash(password, saltRound, async (err, hash) => {
                if (err) {
                    console.log("Error hashing password:", err)
                } else {
                    const user = new User({
                        username: username,
                        email: email,
                        password: hash,
                    })

                    user.save()
                    console.log(`new user ${username} saved to DB`)
                    const data = {
                        user: {
                            id: user.email,
                        },
                    }

                    const token = jwt.sign(data, process.env.VITE_JWT_SECRET)
                    res.json({ success: true, token: token })
                }
            })
        }
    } catch (error) {
        console.log(error)
    }
})

app.post("/login", async (req, res) => {
    const email = req.body.formData.email
    const password = req.body.formData.password
    try {
        const user = await User.findOne({ email: email })
        if (user) {
            brcypt.compare(password, user.password, (err, valid) => {
                if (err) {
                    console.log("Error comparing passwords:", err)
                } else {
                    if (valid) {
                        const data = {
                            user: {
                                id: user.email,
                            },
                        }

                        const token = jwt.sign(data, process.env.VITE_JWT_SECRET)
                        res.json({ success: true, token: token })
                    } else {
                        res.json({ success: false, message: "Incorrect password" })
                    }
                }
            })
        } else {
            res.json({ success: false, message: "No such user registered" })
        }
    } catch (error) {
        console.log(error)
    }
})

app.post("/googlelogin", async(req, res) => {
    const email = req.body.email
    console.log(email)
    try {
        const checkUser = await User.findOne({email:email})
        if (checkUser) {
            console.log("User already registered")
        } else {
            const user = new User({
                email: email,
            })
            user.save()
            console.log(`new user ${email} saved to DB`)
        }
    } catch (error) {
        console.log(error)
    }
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

app.listen(port, () => {
    console.log(`Port Running on http://localhost:${port}`)
})
