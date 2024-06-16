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
    books: {
        type: [Object],
    },
})

app.get("/", (req, res) => {
    res.send("Working")
})

const fetchUser = async (req, res, next) => {
    const token = req.headers["auth-token"]
    if (!token) {
        res.status(401).send({ error: "please authenticate user" })
    } else {
        try {
            const data = jwt.verify(token, process.env.JWT_SECRET)
            req.user = data.user
            next()
        } catch (error) {
            console.log(error)
        }
    }
}

app.patch("/addbook", fetchUser, async (req, res) => {
    const email = req.user.id
    const newBook = {
        id: req.body.id,
        name: req.body.name,
        author: req.body.author,
        isbn: req.body.isbn,
        date: req.body.date,
        rating: req.body.rating,
        link: req.body.link,
        summary: req.body.summary,
        notes: req.body.notes,
        img: req.body.img,
    }
    try {
        const response = await User.findOneAndUpdate({ email: email }, { $push: { books: newBook } }, { new: true })
        console.log(`newbook ${newBook.name} added`)
    } catch (error) {
        console.log(error)
    }
})

app.post("/allbooks", fetchUser, async (req, res) => {
    const email = req.user.id
    try {
        const response = await User.findOne({ email: email })
        const books = response.books
        res.json({ success: true, books: books })
    } catch (error) {
        console.log(error)
    }
})

app.post("/removebook", fetchUser, async (req, res) => {
    const email = req.user.id
    const bookId = req.body.bookId
    try {
        const response = await User.findOneAndUpdate({ email: email }, { $pull: { books: { id: bookId } } }, { new: true })
        res.json({ succes: true, message: `book deleted` })
        console.log("book deleted")
    } catch (error) {
        console.log(error)
    }
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

                    const token = jwt.sign(data, process.env.JWT_SECRET)
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

                        const token = jwt.sign(data, process.env.JWT_SECRET)
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

app.post("/googlelogin", async (req, res) => {
    const email = req.body.email
    try {
        const checkUser = await User.findOne({ email: email })
        if (checkUser) {
            const data = {
                user: {
                    id: email,
                },
            }
            const token = jwt.sign(data, process.env.JWT_SECRET)
            res.json({ success: true, token: token })
        } else {
            const user = new User({
                email: email,
            })
            user.save()
            const data = {
                user: {
                    id: email,
                },
            }
            const token = jwt.sign(data, process.env.JWT_SECRET)

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
