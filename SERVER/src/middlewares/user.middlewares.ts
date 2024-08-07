import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { JsonWebTokenError } from 'jsonwebtoken'
import { capitalize } from 'lodash'
import { ObjectId } from 'mongodb'
import { env } from '~/config/environment'
import { UserVerifyStatus } from '~/constants/enum'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGES } from '~/constants/messages'
import { REGEX_USERNAME } from '~/constants/regex'
import { errorWithStatus } from '~/models/errors'
import { TokenPayload } from '~/models/requests/Users.requests'
import databaseService from '~/services/database.services'
import userService from '~/services/user.services'
import { hashPassword } from '~/utils/crypto'
import { verifyToken } from '~/utils/jwt'
import {
  confirmPasswordSchema,
  dateOfBirthSchema,
  forgotPasswordToken,
  imageSchema,
  nameSchema,
  passwordSchema,
  userIdSchema
} from '~/utils/schemaValidationOptions'
import { validate } from '~/utils/validate'

/**
 * @RegisterValidator
 */
export const registerValidator = validate(
  checkSchema(
    {
      name: nameSchema,
      email: {
        notEmpty: {
          errorMessage: USER_MESSAGES.EMAIL_IS_REQUIRED
        },
        isEmail: {
          errorMessage: USER_MESSAGES.EMAIL_IS_INVALID
        },
        trim: true,
        custom: {
          options: async (value: string) => {
            const isEmailExit = await userService.checkMailExit(value)
            if (isEmailExit) {
              throw new Error(USER_MESSAGES.EMAIL_ALREADY_EXISTS)
            }
            return true
          }
        }
      },
      password: passwordSchema,
      confirm_password: confirmPasswordSchema,
      date_of_birth: dateOfBirthSchema
    },
    ['body']
  )
)

/**
 * @emailVerifyTokenValidator
 */
export const emailVerifyTokenValidator = validate(
  checkSchema(
    {
      email_verify_token: {
        trim: true,
        notEmpty: {
          errorMessage: USER_MESSAGES.EMAIL_VERIFY_TOKEN_IS_REQUIRED
        },
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new errorWithStatus({
                message: USER_MESSAGES.EMAIL_VERIFY_TOKEN_IS_REQUIRED,
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            try {
              const decoded_email_verify_token = await verifyToken({
                token: value,
                secretOrPrivateKey: env.JWT_SECRET_EMAIL_VERIFY_TOKEN as string
              })
              req.decoded_email_verify_token = decoded_email_verify_token
            } catch (error) {
              throw new errorWithStatus({
                message: capitalize((error as JsonWebTokenError).message),
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            return true
          }
        }
      }
    },
    ['body']
  )
)

/**
 *@pLoginValidator
 */
export const loginValidator = validate(
  checkSchema(
    {
      email: {
        notEmpty: {
          errorMessage: USER_MESSAGES.EMAIL_IS_REQUIRED
        },
        isEmail: {
          errorMessage: USER_MESSAGES.EMAIL_IS_INVALID
        },
        trim: true,
        custom: {
          options: async (value, { req }) => {
            const user = await databaseService.users.findOne({
              email: value,
              password: hashPassword(req.body.password)
            })
            if (user === null) {
              throw new Error(USER_MESSAGES.USER_NOT_FOUND)
            }
            req.user = user
            return true
          }
        }
      },
      password: {
        notEmpty: {
          errorMessage: USER_MESSAGES.PASSWORD_IS_REQUIRED
        },
        isString: {
          errorMessage: USER_MESSAGES.PASSWORD_MUST_BE_A_STRING
        },

        isLength: {
          options: {
            min: 6,
            max: 50
          }
        },
        isStrongPassword: {
          options: {
            minLength: 6,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
          },
          errorMessage: USER_MESSAGES.PASSWORD_LENGTH_MUST_BE_FROM_6_TO_50
        }
      }
    },
    ['body']
  )
)

/**
 * @accessTokenValidator
 */
export const accessTokenValidator = validate(
  checkSchema(
    {
      Authorization: {
        trim: true,
        custom: {
          options: async (value: string, { req }) => {
            const access_token = (value || '').split(' ')[1]
            if (!access_token) {
              throw new errorWithStatus({
                message: USER_MESSAGES.ACCESS_TOKEN_IS_REQUIRED,
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            try {
              const decoded_authorization = await verifyToken({
                token: access_token,
                secretOrPrivateKey: env.JWT_SECRET_ACCESS_TOKEN as string
              })
              req.decoded_authorization = decoded_authorization
            } catch (error) {
              throw new errorWithStatus({
                message: capitalize((error as JsonWebTokenError).message),
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            return true
          }
        }
      }
    },
    ['headers']
  )
)

/**
 * @accessTokenValidator
 */
export const refreshTokenValidator = validate(
  checkSchema(
    {
      refresh_token: {
        notEmpty: {
          errorMessage: USER_MESSAGES.REFRESH_TOKEN_IS_REQUIRED
        },
        custom: {
          options: async (value: string, { req }) => {
            try {
              const [decoded_refeshToken, refresh_token] = await Promise.all([
                verifyToken({ token: value, secretOrPrivateKey: process.env.JWT_SECRET_RERFESH_TOKEN as string }),
                databaseService.refeshTokens.findOne({ token: value })
              ])
              if (refresh_token === null) {
                throw new errorWithStatus({
                  message: USER_MESSAGES.USED_REFRESH_TOKEN_OR_NOT_EXIST,
                  status: HTTP_STATUS.UNAUTHORIZED
                })
              }
              ;(req as Request).decoded_refeshToken = decoded_refeshToken
            } catch (error) {
              if (error instanceof JsonWebTokenError) {
                throw new errorWithStatus({
                  message: capitalize(USER_MESSAGES.REFRESH_TOKEN_IS_INVALID),
                  status: HTTP_STATUS.UNAUTHORIZED
                })
              }
              throw error
            }
            return true
          }
        }
      }
    },
    ['body']
  )
)

/**
 * @forgotPasswordValidator
 */
export const forgotPasswordValidator = validate(
  checkSchema(
    {
      email: {
        notEmpty: {
          errorMessage: USER_MESSAGES.EMAIL_IS_REQUIRED
        },
        isEmail: {
          errorMessage: USER_MESSAGES.EMAIL_IS_INVALID
        },
        trim: true,
        custom: {
          options: async (value: string, { req }) => {
            const user = await databaseService.users.findOne({ email: value })
            if (user === null) {
              throw new Error(USER_MESSAGES.USER_NOT_FOUND)
            }
            req.user = user
            return true
          }
        }
      }
    },
    ['body']
  )
)

/**
 * @verifyForgotPasswordValidator
 */
export const verifyForgotPasswordValidator = validate(
  checkSchema(
    {
      forgot_password_token: forgotPasswordToken
    },
    ['body']
  )
)

/**
 * @resetPasswordValidator
 */
export const resetPasswordValidator = validate(
  checkSchema(
    {
      password: passwordSchema,
      confirm_password: confirmPasswordSchema,
      forgot_password_token: forgotPasswordToken
    },
    ['body']
  )
)

/**
 * @verifyUserValidatior
 */
export const verifyUserValidatior = async (req: Request, res: Response, next: NextFunction) => {
  const { verify } = (req as Request).decoded_authorization as TokenPayload

  if (verify !== UserVerifyStatus.Verified) {
    return next(
      new errorWithStatus({
        message: USER_MESSAGES.USER_NOT_VERIFIED,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

/**
 * @updateMeValidator
 */
export const updateMeValidator = validate(
  checkSchema({
    name: {
      ...nameSchema,
      optional: true,
      notEmpty: undefined
    },
    date_of_birth: {
      ...dateOfBirthSchema,
      optional: true
    },
    bio: {
      optional: true,
      isString: {
        errorMessage: USER_MESSAGES.BIO_MUST_BE_STRING
      },
      trim: true,
      isLength: {
        options: {
          min: 1,
          max: 200
        },
        errorMessage: USER_MESSAGES.BIO_LENGTH
      }
    },
    location: {
      optional: true,
      isString: {
        errorMessage: USER_MESSAGES.LOCATION_MUST_BE_STRING
      },
      trim: true,
      isLength: {
        options: {
          min: 1,
          max: 200
        },
        errorMessage: USER_MESSAGES.LOCATION_LENGTH
      }
    },
    website: {
      optional: true,
      isString: {
        errorMessage: USER_MESSAGES.WEBSITE_MUST_BE_STRING
      },
      trim: true,
      isLength: {
        options: {
          min: 1,
          max: 200
        },
        errorMessage: USER_MESSAGES.WEBSITE_LENGTH
      }
    },
    username: {
      optional: true,
      isString: {
        errorMessage: USER_MESSAGES.USERNAME_MUST_BE_STRING
      },
      trim: true,
      isLength: {
        options: {
          min: 1,
          max: 200
        },
        errorMessage: USER_MESSAGES.USERNAME_LENGTH
      },
      custom: {
        options: async (value: string, { req }) => {
          if (!REGEX_USERNAME.test(value)) {
            throw new Error(USER_MESSAGES.USERNAME_INVALID)
          }

          const user = await databaseService.users.findOne({
            username: value
          })
          if (user) {
            throw new Error(USER_MESSAGES.USERNAME_EXISTED)
          }
        }
      }
    },
    avatar: imageSchema,
    cover_photo: imageSchema
  })
)

/**
 * @followValidator
 */
export const followValidator = validate(
  checkSchema(
    {
      followed_user_id: userIdSchema
    },
    ['body']
  )
)

/**
 * @unfollowValidator
 */
export const unfollowValidator = validate(
  checkSchema(
    {
      user_id: userIdSchema
    },
    ['params']
  )
)

/**
 * @changePasswordValidator
 */
export const changePasswordValidator = validate(
  checkSchema({
    old_password: {
      ...passwordSchema,
      custom: {
        options: async (value: string, { req }) => {
          const { user_id } = (req as Request).decoded_authorization as TokenPayload
          const user = await databaseService.users.findOne({
            _id: new ObjectId(user_id)
          })
          if (!user) {
            throw new errorWithStatus({
              message: USER_MESSAGES.USER_NOT_FOUND,
              status: HTTP_STATUS.NOT_FOUND
            })
          }
          if (user.password !== hashPassword(value)) {
            throw new errorWithStatus({
              message: USER_MESSAGES.OLD_PASSWORD_NOT_MATCH,
              status: HTTP_STATUS.UNAUTHORIZED
            })
          }
        }
      }
    },
    password: passwordSchema,
    confirm_password: confirmPasswordSchema
  })
)

export const isLoggedValidation = (middleware: (req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
      return middleware(req, res, next)
    }
    next()
  }
}

export const getConversationsValidator = validate(
  checkSchema(
    {
      receiver_id: userIdSchema
    },
    ['params']
  )
)
