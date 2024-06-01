// initial plan: the website should have topic wise questions, customized tests, coding profiles page, daily challenge, 
// helpful resources page for weak topics

// I have properly formatted and loaded the test data into the db- 27/5
// compile test-cases against the problems and use an API to check the submission- 28/5

import express from "express";
import bodyParser from "body-parser";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from "pg";
import ejs from "ejs";
import axios from "axios";
import cookieParser from "cookie-parser";
import LlamaAI from "llamaai";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(cookieParser())

// paste




db.connect();

var msg = "";

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if(result.rows.length>0) {
        const user = result.rows[0];
        let validate = await bcrypt.compare(password, user.password);
        if(validate){
            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_TOKEN, { expiresIn: '2h' });
            res.cookie('token', token, { httpOnly: true });
            msg = `You are logged in as ${username}`;
            res.redirect('/');
        } else {
            msg = "Wrong password. Try again.";
            res.redirect('/');
        }
    } else {
        msg = "You are not in our database. Try signing up for an account or re-login.";
        res.redirect('/');
    }

    //res.redirect('/login');
});

app.post('/signup', async (req, res) => {
    const {username, password} = req.body;
    if(req.body.repassword != req.body.password){
        res.render("signuppage.ejs", { wrning: "The password you re-entered does not match the new password." });
    }
    else {
        const hashed = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (username, password) VALUES ($1, $2);', [username, hashed], (err, rep) => {
            if(err){
                res.render("loginpage.ejs", {alert: "You already have an account with us."});
            } else {
                res.redirect('/logindirect');
            }
        });
    }
        
})

app.post("/logout", (req, res) => {
    res.clearCookie('token');
    msg = "You have been logged out."; 
    res.redirect('/');
    
})
// for run-code and update-credits
const authenticate = function auth (req, res, next) {
    console.log(req.cookies);
    const token = req.cookies.token;
    if (typeof(token) == undefined) return res.redirect('/login');

    jwt.verify(token, SECRET_TOKEN, (err, user) => {
        if (err) return res.redirect('/login');
        req.user = user;
        next();
    })
};

// if question is right
async function updateCreds(user, creds){
    const result = await db.query("SELECT credits FROM users WHERE username = $1", [user.username]);
    if (result.rows.length > 0) {
        // i have set a condition for all usernames to be unique - 1 result is guaranteed
        let newCreds = result.rows[0].credits+=creds;
        await db.query("UPDATE users SET credits = $1 WHERE username = $2;", [newCreds, user.username]);
    } else {
        // what to do here?
        console.error("something went wrong");
    }
}

async function runCode(language, src_code, input) {
    try {
        const result = await axios.post(
            'https://api.judge0.com/submissions/?base64_encoded=false&wait=true',
            {
                language, 
                src_code, 
                input
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    // paste 
                    
                    
                },
            }
        )
        return result.data;

    } catch(err) {
        console.error(err);
    }
}

app.post("/run-code", authenticate, async (req, res) => {
    const problem_statement = req.body.qtitle;
    const language = req.body.language;
    const src_code = req.body.submission;
    console.log(problem_statement);
    const response = await db.query("SELECT credits, input, expected_output FROM PROBLEMS WHERE title = $1", [problem_statement]);
    if(response.rows.length > 0) {
        const testcases = response.rows;
        console.log(testcases);
        const creds = testcases[0].credits;
        console.log(creds);
        const input = testcases[0].input;
        console.log(input);
        const expectedOutput = testcases[0].expected_output;
        console.log(expectedOutput)
        for(let i = 0; i < input.length; i++) {
            const submissionResult = await runCode(language, src_code, input[i]);
            console.log(submissionResult);
            const status = submissionResult.stdout.trim() == expectedOutput[i].trim();
            if(status == false){
                let warning = `${expectedOutput[i]} was expected but your program gave the output ${submissionResult.stdout} for the problem ${problem_statement}.`;
                return res.render("test.ejs", {warning: warning});
            }
            
        }
        updateCreds(req.user, creds);
        res.redirect('/test');
    } else{
        // what to do here?
        res.status(500).send("Error in processing code submission.");
    }
        
    
})


app.get("/test", async (req, res) => {
    const {format, topic, diff} = req.query;
    // const long_num = 8;
    // const short_num = 4;
    // const long_hrs = 3.5;
    // const short_hrs = 2; -> set timing
    console.log(typeof(topic));
    let results = await db.query("SELECT * FROM problems WHERE $1 = ANY (tags) AND difficulty = $2;", [topic, diff]);
    if(results.rows.length > 0) {
        let qs = [];
        for(let i = 0; i < results.rows.length; i++) {
            qs.push({
                title: results.rows[i].title,
                question: results.rows[i].question,
                examples: results.rows[i].examples,
                difficulty: results.rows[i].difficulty,
                credits: results.rows[i].credits,
                tags: results.rows[i].tags
            });
        }
        res.render("test.ejs", {qs: qs});
    } else {
        // what status code to send? - 404 Resource Not Found
        res.render("404.ejs");
    }
    //res.render("test.ejs");
});

//paste
const llamaAPI = new LlamaAI(API_KEY);

app.get("/interview", async (req, res) => {
    // Build the Request
    console.log(req.body.info)
    const info = "I am Sridevi, a second year CS undergraduate. I am affluent in OOP, web dev and competitive coding. I am interested to learn app dev, ML, AI and game dev.";
    //console.log(info);
    const apiRequestJson = {
    "messages": [
        {"role": "user", "content": info},
    ],
    "functions": [
        {
            "name": "interview_the_user",
            "description": "Act as an interviewer and based off the information given by the user, ask the user typical software engineering interview questions based on the user's strengths as well as LeetCode medium questions. Ask them about their projects and experience as well. The user is a computer science undergraduate, ask them questions related to their coursework as well.",
            "parameters": {
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "string",
                        "description": "A list of the questions you want to ask the user.",
                    },
                    "time_limit": {
                        "type": "number",
                        "description": "Average time limit for a user to respond to each question",
                    },
                    "expected_response" : {
                        "type": "string",
                        "description": "The correct answer for each question.",
                    }
                },
            },
            "required": ["questions", "time_limit"],
        }
    ],
    "stream": false,
    "function_call": "interview_the_user",
   };
   try {
        const response = await llamaAPI.run(apiRequestJson);
        console.log(response.choices[0].message.function_call.arguments.interests);
        //const response_json = await response.json(); 
        res.render("interviewer.ejs", { msg: response });
    } catch (error) {
        console.error(error);
        res.render("interviewer.ejs", { msg: "exception caught!" });
    }
})

app.get("/profile", (req, res) => {
    res.render("profile.ejs");
})

app.get('/signupdirect', (req, res) => {
    res.render("signuppage.ejs");
});

app.get("/", (req, res) => {
    res.render("index.ejs", {msg: msg});
});

app.get("/logindirect", (req, res) => {
    res.render("loginpage.ejs");
});

app.listen(3000, () => {
    console.log('server is up and listening on port 3000.')
});

