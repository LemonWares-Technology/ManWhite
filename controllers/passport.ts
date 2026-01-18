import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../lib/prisma";
import env from "dotenv";
env.config();


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "PLACEHOLDER_CLIENT_SECRET",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
    },
    async (accessToken, refreshGoogleToken, profile, done) => {
      const email = profile?.emails?.[0].value;
      const avatar = profile?.photos?.[0].value;

      if (!email) return done(new Error("No email found"));

      try {
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              googleId: profile.id,
              avatarUrl: avatar,
              verified: true,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);


passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: string, done) => {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  });