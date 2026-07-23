import type { Paginator } from "@smithy/types";
import { DescribeLogStreamsCommandInput, DescribeLogStreamsCommandOutput } from "../commands/DescribeLogStreamsCommand";
import type { CloudWatchLogsPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateDescribeLogStreams: (config: CloudWatchLogsPaginationConfiguration, input: DescribeLogStreamsCommandInput, ...rest: any[]) => Paginator<DescribeLogStreamsCommandOutput>;
