import { NextFunction, Request, Response } from 'express'
import { pick } from 'lodash'

type Filterkeys<T> = Array<keyof T>

export const filterMiddleware =
  <T>(filterKeys: Filterkeys<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    req.body = pick(req.body, filterKeys)
    next()
  }
