import type { Paginator } from "@smithy/types";
import { GetScheduledQueryHistoryCommandInput, GetScheduledQueryHistoryCommandOutput } from "../commands/GetScheduledQueryHistoryCommand";
import type { CloudWatchLogsPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateGetScheduledQueryHistory: (config: CloudWatchLogsPaginationConfiguration, input: GetScheduledQueryHistoryCommandInput, ...rest: any[]) => Paginator<GetScheduledQueryHistoryCommandOutput>;
