import dotenv from 'dotenv'

// Load environment variables before creating the Passport strategy.
dotenv.config()

import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const clientID = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const callbackURL = process.env.GOOGLE_CALLBACK_URL

if (!clientID) {
  console.error(
    'ERROR: GOOGLE_CLIENT_ID is missing from backend .env'
  )
}

if (!clientSecret) {
  console.error(
    'ERROR: GOOGLE_CLIENT_SECRET is missing from backend .env'
  )
}

if (!callbackURL) {
  console.error(
    'ERROR: GOOGLE_CALLBACK_URL is missing from backend .env'
  )
}

passport.use(
  new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const email =
          profile.emails?.[0]?.value?.toLowerCase()

        const name =
          profile.displayName ||
          profile.name?.givenName ||
          'Google User'

        if (!email) {
          return done(
            new Error(
              'Google account did not provide an email address.'
            ),
            null
          )
        }

        let user =
          await prisma.user.findUnique({
            where: {
              email,
            },
          })

        // ======================================================
        // EXISTING USER
        // ======================================================
        if (!user) {
          user = await prisma.user.create({
            data: {
              name,
              email,
              password: `GOOGLE_${profile.id}`,
              role: 'BUYER',
              verified: true,
            },
          })
        } else if (!user.verified) {
          user =
            await prisma.user.update({
              where: {
                id: user.id,
              },
              data: {
                verified: true,
              },
            })
        }

        return done(null, user)
      } catch (error) {
        console.error(
          'Google authentication error:',
          error
        )

        return done(error, null)
      }
    }
  )
)

export default passport