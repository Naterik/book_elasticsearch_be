import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { loginWithGoogle as loginUserWithGoogle } from "services/auth.service";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT) {
  console.error("❌ Missing Google OAuth configuration");
  process.exit(1);
}

const loginWithGoogle = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_REDIRECT, // Phải khớp với Google Console
        // Thêm options này để rõ ràng hơn
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error("No email found from Google"), null);
          }
          const user = await loginUserWithGoogle(email, profile);

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
};

export default loginWithGoogle;
