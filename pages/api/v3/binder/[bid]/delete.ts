import { NextApiRequest, NextApiResponse } from 'next';
import { ApiResponse, ListResponse } from '../../';
import middleware from '@pages/api/database/middleware';
import Cors from 'cors';
import { DELETE } from '@constants/http-methods';
import { cardsQuery } from '@pages/api/database/database';
import SQL from 'sql-template-strings';
import { checkUserAuthorization } from '../../lib/checkUserAuthorization';
import { StatusCodes } from 'http-status-codes';
import methodNotAllowed from '../../lib/methodNotAllowed';

const allowedMethods: string[] = [DELETE] as const;
const cors = Cors({
  methods: allowedMethods,
});

export default async function delete_binder(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<Trade | null>>>
): Promise<void> {
  await middleware(req, res, cors);
  const bid = req.query.bid  as string

  if (req.method === DELETE) {
    try {
      // Check if user is authenticated
      if (!(await checkUserAuthorization(req))) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          status: 'error',
          message: 'Not authorized',
          payload: null,
        });
        return;
      }

      if (!bid) {
        res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Missing required fields binderID',
          payload: null,
        });
        return;
      }

      // Check if the binder belongs to the authenticated user
      const binderCheck = await cardsQuery<{ uid: number }>(
        SQL`SELECT uid FROM pbe_binders WHERE binderid=${bid}`
      );

      if ('error' in binderCheck || binderCheck.length === 0) {
        res.status(StatusCodes.NOT_FOUND).json({
          status: 'error',
          message: 'Binder not found',
          payload: null,
        });
        return;
      }

      const binderOwner = binderCheck[0].uid;
      const currentUserId = parseInt(req.cookies.userid);

      if (binderOwner !== currentUserId) {
        res.status(StatusCodes.FORBIDDEN).json({
          status: 'error',
          message: 'You do not have permission to delete this binder',
          payload: null,
        });
        return;
      }

      // Delete binder cards first (foreign key constraint)
      await cardsQuery(
        SQL`DELETE FROM pbe_binder_cards WHERE binderid=${bid}`
      );

      // Then delete the binder
      await cardsQuery(
        SQL`DELETE FROM pbe_binders WHERE binderid=${bid}`
      );

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: null,
      });
      return;
    } catch (error) {
      console.error('Error deleting binder:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to delete binder',
        payload: null,
      });
      return;
    }
  }

  methodNotAllowed(req, res, allowedMethods);
}