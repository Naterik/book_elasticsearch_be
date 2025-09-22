import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import passport from "passport";
import { handleLoginWithGoogle } from "services/auth.services";

const clientID = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const callbackURL = process.env.GOOGLE_REDIRECT!;

type PublicUser = {
  id: number;
  username: string;
  fullName: string | null;
  membershipStart: Date | null;
  membershipEnd: Date | null;
  role: {
    name: string;
    id: number;
    description: string;
  };
};
const loginWithGoogle = () => {
  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        cb
      ) => {
        try {
          const data = {
            googleId: profile.id,
            fullName: profile._json.name ?? "",
            username: profile._json.email,
            avatar: profile._json.picture ?? "",
            type: "GOOGLE",
          };
          const user: PublicUser = await handleLoginWithGoogle(data);

          return cb(null, user);
        } catch (err) {
          return cb(null, err);
        }
      }
    )
  );
};

export { loginWithGoogle };
