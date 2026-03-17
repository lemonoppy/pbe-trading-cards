import { userGroups } from 'lib/constants'
import { NextApiRequest } from 'next'
import * as jwt from 'jsonwebtoken'
import { portalApi } from '@pages/api/database/database'

export const checkUserAuthorization = async (
  req: NextApiRequest,
  options?: {
    validRoles?:
      | keyof Readonly<typeof userGroups>
      | (keyof Readonly<typeof userGroups>)[]
  }
): Promise<boolean> => {
  const authHeader: string = req.headers.authorization
  const bearerPrefix: string = 'Bearer '

  if (!authHeader?.startsWith(bearerPrefix)) {
    console.error('Missing valid bearer prefix')
    return false
  }

  const token: string = authHeader.substring(
    bearerPrefix.length,
    authHeader.length
  )

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET ?? '')

    if (typeof decodedToken === 'string' || !('userid' in decodedToken)) {
      console.error('Decoded token is malformed', decodedToken)
      return false
    }

    const useridCookieMatchesToken: boolean =
      req.cookies.userid === decodedToken.userid.toString()

    if (options?.validRoles) {
      try {
        // Build cookies string to forward to Portal
        const cookiesString = Object.entries(req.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ')

        // Fetch user permissions from Portal API using the user's token and cookies
        const userPermissions = await portalApi.getUserPermissions(
          decodedToken.userid,
          token,
          cookiesString
        )

        const groups = userPermissions.groups

        console.log('User permissions check:', {
          userid: decodedToken.userid,
          groups,
          validRoles: options.validRoles,
          expectedGroups: Array.isArray(options.validRoles)
            ? options.validRoles.map(role => ({ role, groupId: userGroups[role] }))
            : [{ role: options.validRoles, groupId: userGroups[options.validRoles] }],
          hasSudo: req.cookies.sudo === 'true',
          cookieMatchesToken: useridCookieMatchesToken
        })

        if (
          'sudo' in req.cookies &&
          req.cookies.sudo === 'true' &&
          groups.includes(userGroups.DOTTS_ADMIN)
        ) {
          console.log('Authorized via sudo mode')
          return useridCookieMatchesToken
        }

        const hasValidRole = groups.some((group) => {
          if (typeof options.validRoles === 'string') {
            return userGroups[options.validRoles] === group
          }
          return options.validRoles?.some((role) => userGroups[role] === group)
        })

        console.log('Role check result:', { hasValidRole, useridCookieMatchesToken })

        return (
          useridCookieMatchesToken && hasValidRole
        )
      } catch (error) {
        console.error('Error fetching user permissions from Portal:', error)
        return false
      }
    }

    return useridCookieMatchesToken
  } catch (error) {
    console.error('Token verification error:', error)
    return false
  }
}
