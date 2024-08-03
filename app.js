const express = require("express");
const bodyParser = require("body-parser");
const QRCode = require("qrcode");
const expressLayouts = require("express-ejs-layouts");
const { body, validationResult } = require("express-validator");
const mysql = require("mysql2");

const app = express();

// Create a connection to the MySQL database
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "6789@jkl",
    database: "apartment_access_control",
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error("Error connecting to the database: " + err.stack);
        return;
    }
    console.log("Connected to the database as id " + db.threadId);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "layout");

// Home page route
app.get("/", (req, res) => {
    res.render("index", { title: "Home" });
});

// Resident login route
app.post("/resident", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM user WHERE email = ? AND password = ? AND user_type = 'resident'",
        [email, password],
        (err, results) => {
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).send("Error querying the database");
            }

            if (results.length > 0) {
                db.query(
                    "SELECT * FROM access_key WHERE user_id = ?",
                    [results[0].id],
                    (err, accessKeyResults) => {
                        if (err) {
                            console.error("Error querying the access_key table:", err);
                            return res.status(500).send("Error querying the access_key table");
                        }
                        const expireDate = accessKeyResults[0].expire_date;
                        const qrData = JSON.stringify({
                            user_id: accessKeyResults[0].user_id,
                            expire_date: expireDate,
                            building_id: accessKeyResults[0].building_id,
                            access_level: accessKeyResults[0].access_level,
                            room_number: accessKeyResults[0].room_number,
                        });
                        let allVisitors = [];
                        QRCode.toDataURL(qrData, (err, url) => {
                            if (err) {
                                console.error("Error generating QR code:", err);
                                return res.send("Error generating QR code");
                            }

                            db.query(
                                "SELECT visitor_id FROM visitor_request",
                                (err, visitorRequestResults) => {
                                    if (err) {
                                        console.error("Error querying the visitor_request table:", err);
                                        return res
                                            .status(500)
                                            .send("Error querying the visitor_request table");
                                    }

                                    if (visitorRequestResults.length > 0) {
                                        const visitorIds = visitorRequestResults.map(
                                            (result) => result.visitor_id
                                        );
                                        console.log(visitorIds);
                                        db.query(
                                            "SELECT * FROM user WHERE id IN (?) AND user_type = 'visitor'",
                                            [visitorIds],
                                            (err, visitorResults) => {
                                                if (err) {
                                                    console.error("Error querying the user table:", err);
                                                    return res
                                                        .status(500)
                                                        .send("Error querying the user table");
                                                }
                                                console.log(visitorResults);
                                                allVisitors = visitorResults;
                                                res.render("qr", {
                                                    qrCodeUrl: url,
                                                    validity: expireDate,
                                                    title: "Your QR Code Expire at",
                                                    visitors: visitorResults,
                                                });
                                            }
                                        );
                                    } else {
                                        res.render("qr", {
                                            qrCodeUrl: url,
                                            validity: expireDate,
                                            title: "Your QR Code Expire at",
                                            visitors: [],
                                        });
                                    }
                                }
                            );
                        });
                        console.log("---");
                        console.log(allVisitors);
                    });
            } else {
                res.send("Invalid username or password");
            }
        }
    );
});

// Approve visitor route
app.post("/approve-visitor", (req, res) => {
    const { visitorId } = req.body;
    console.log(req.body);
    db.query(
        "UPDATE visitor_request SET status = 'approve' WHERE visitor_id = ?",
        [parseInt(visitorId)],
        (err, results) => {
            if (err) {
                console.error("Error updating visitor_request table:", err);
                return res.status(500).send("Error approving visitor request");
            }
            return res.status(200).send();
        }
    );
});

// Decline visitor route
app.post("/decline-visitor", (req, res) => {
    const { visitorId } = req.body;

    db.query(
        "UPDATE visitor_request SET status = 'declined' WHERE visitor_id = ?",
        [visitorId],
        (err, results) => {
            if (err) {
                console.error("Error updating visitor_request table:", err);
                return res.status(500).send("Error declining visitor request");
            }
            res.redirect("/qr");
        }
    );
});

// Update visitor status
app.patch("/update-visitor-status", (req, res) => {
    const { visitorId, status } = req.body;
    console.log(req.body);
    db.query(
        "UPDATE visitor_request SET status = ? WHERE visitor_id = ?",
        [status, parseInt(visitorId)],
        (err, results) => {
            if (err) {
                console.error("Error updating visitor status:", err);
                return res.status(500).send("Error updating visitor status");
            }

            res.send("Visitor status updated successfully");
        }
    );
});

app.post("/visitor", (req, res) => {
    const { username } = req.body;

    db.query(
        "SELECT * FROM user WHERE username = ? AND user_type = 'visitor'",
        [username],
        (err, results) => {
            if (err) {
                console.error("Error querying the database:", err);
                return res.status(500).send("Error querying the database");
            }

            if (results.length > 0) {
                db.query(
                    "SELECT * FROM visitor_request WHERE visitor_id = ?",
                    [results[0].id],
                    (err, visitorRequests) => {
                        if (err) {
                            console.error("Error querying the visitor_request table:", err);
                            return res
                                .status(500)
                                .send("Error querying the visitor_request table");
                        }

                        const visitorInfo = {
                            user_id: results[0].id,
                            email: results[0].email,
                            phone_number: results[0].phone_number,
                            resident_name: results[0].resident_name,
                            room_number: results[0].room_number,
                            expire_date: visitorRequests[0]?.expire_date || null,
                        };
                        const visitorRequestStatus = visitorRequests[0]?.status || "pending";
                        console.log(visitorRequests[0]);

                        if (visitorRequestStatus === "approve") {
                            const date = new Date();
                            date.setHours(date.getHours() + 24);
                            visitorInfo.expire_date = date;

                            QRCode.toDataURL(JSON.stringify(visitorInfo), (error, URL) => {
                                if (error) {
                                    console.error("Error generating QR code:", error);
                                    return res.status(500).send("Error generating QR code");
                                }

                                res.render("visitorstatus", {
                                    username: username,
                                    email: results[0].email,
                                    phone_number: results[0].phone_number,
                                    resident_name: results[0].resident_name,
                                    room_number: results[0].room_number,
                                    status: visitorRequestStatus,
                                    title: "visitorpage",
                                    visitorRequests: visitorRequests,
                                    qrCodeUrl: URL,
                                    validity: date.toLocaleString(),
                                });
                            });
                        } else {
                            res.render("visitorstatus", {
                                username: username,
                                email: results[0].email,
                                phone_number: results[0].phone_number,
                                resident_name: results[0].resident_name,
                                room_number: results[0].room_number,
                                status: visitorRequestStatus,
                                title: "visitorpage",
                                visitorRequests: visitorRequests,
                                qrCodeUrl: null,
                                validity: null,
                            });
                        }
                    }
                );
            } else {
                res.send("Invalid username");
            }
        }
    );
});

app.get("/guest", (req, res) => {
    res.render("guest", { title: "Guest Registration" });
});

// Guest QR code route
app.post(
    "/guest",
    [
        body("username")
            .isAlpha()
            .withMessage("Username should contain letters only"),
        body("phone")
            .isNumeric()
            .withMessage("Phone number should contain digits only"),
        body("email").isEmail().withMessage("Please enter a valid email address"),
        body("resident")
            .isAlpha()
            .withMessage("Resident name should contain letters only"),
        body("room_number")
            .isAlphanumeric()
            .withMessage("Room number should be alphanumeric"),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render("guest", {
                title: "Guest Registration",
                errors: errors.array(),
            });
        }

        const guestInfo = req.body;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 1);
        const qrData = JSON.stringify({
            username: guestInfo.username,
            email: guestInfo.email,
            phone_number: guestInfo.phone,
            resident_name: guestInfo.resident,
            room_number: guestInfo.room_number,
            expire_date: expiryDate,
        });

        db.query(
            "INSERT INTO user (username, email, phone_number, resident_name, room_number, user_type) VALUES (?, ?, ?, ?, ?, 'visitor')",
            [
                guestInfo.username,
                guestInfo.email,
                guestInfo.phone,
                guestInfo.resident,
                guestInfo.room_number,
            ],
            (err, results) => {
                if (err) {
                    console.error("Error inserting into user table:", err);
                    return res.status(500).send("Error registering visitor");
                }

                const visitorId = results.insertId;

                db.query(
                    "SELECT id FROM user WHERE username = ? AND user_type = 'resident'",
                    [guestInfo.resident],
                    (err, results) => {
                        if (err) {
                            console.error("Error querying the user table:", err);
                            return res.status(500).send("Error registering visitor");
                        }

                        if (results.length > 0) {
                            const residentId = results[0].id;

                            db.query(
                                "INSERT INTO visitor_request (resident_id, visitor_id, status) VALUES (?, ?, 'pending')",
                                [residentId, visitorId],
                                (err, results) => {
                                    if (err) {
                                        console.error(
                                            "Error inserting into visitor_request table:",
                                            err
                                        );
                                        return res
                                            .status(500)
                                            .send("Error creating visitor request");
                                    }

                                    res.render("visitorstatus", {
                                        username: guestInfo.username,
                                        email: guestInfo.email,
                                        phone_number: guestInfo.phone_number,
                                        resident_name: guestInfo.resident,
                                        room_number: guestInfo.room_number,
                                        status: "pending",
                                        title: "visitorpage",
                                        visitorRequests: [],
                                        qrCodeUrl: null,
                                        validity: null,
                                    });
                                }
                            );
                        } else {
                            console.error("Resident not found");
                            res.status(400).send("Resident not found");
                        }
                    }
                );
            }
        );
    }
);

app.get("/signup", (req, res) => {
    res.render("signup", { title: "Resident Registration" });
});

app.post("/signup", async (req, res) => {
    const { name, password, email, phone, room_number } = req.body;

    try {
        // Check if the username already exists
        const results = await db.query("SELECT * FROM user WHERE email = ?", [
            email,
        ]);
        if (results.length > 0) {
            return res.status(400).send("Email already exists");
        }

        // Insert the new user into the database
        const insertQuery = `
  INSERT INTO user (name, password, email, phone, room_number, user_type)
  VALUES (?, ?, ?, ?, ?, 'resident')
`;
        await db.query(insertQuery, [name, password, email, phone, room_number]);

        return res.render("index", { title: "Home" });
    } catch (err) {
        console.error("Error querying the database:", err);
        res.status(500).send("Error querying the database");
    }
});

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
