
console.log("✅ auth.js is loaded");

const auth = firebase.auth();
const db = firebase.firestore();

// LOGIN FUNCTION
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginForm['email'].value;
    const password = loginForm['password'].value;

    auth.signInWithEmailAndPassword(email, password)
      .then((cred) => {
        return cred.user.reload().then(() => {
          console.log("Email verified status:", cred.user.emailVerified); // Debugging
          if (cred.user.emailVerified) {
            alert("Login successful!");
            window.location.href = "home.html";
          } else {
            alert("Please verify your email before logging in.");
            auth.signOut();
          }
        });
      })
      .catch(error => {
        alert("Login error: " + error.message);
        console.error("Login error:", error);
      });
  });
}

// SIGNUP FUNCTION
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = signupForm['name'].value;
    const email = signupForm['email'].value;
    const password = signupForm['password'].value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        return db.collection('users').doc(cred.user.uid).set({
          fullName: name,
          email: email,
          createdAt: new Date()
        }).then(() => {
          return cred.user.sendEmailVerification();
        });
      })
      .then(() => {
        alert("Account created! A verification email has been sent. Please verify your email before logging in.");
        auth.signOut();
        window.location.href = "login.html";
      })
      .catch((error) => {
        alert("Signup error: " + error.message);
        console.error("Signup error:", error);
      });
  });
}

// FORGOT PASSWORD FUNCTION
function sendPasswordReset() {
  const email = document.getElementById("email").value;
  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      alert("Password reset email sent. Check your inbox.");
    })
    .catch((error) => {
      alert("Error: " + error.message);
      console.error("Reset error:", error);
    });
}
