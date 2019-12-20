import { SecurityHandlers } from '../framework/types';
import { OpenApiContext } from '../framework/openapi.context';
export declare function security(context: OpenApiContext, securityHandlers: SecurityHandlers): (req: any, res: any, next: any) => Promise<any>;
