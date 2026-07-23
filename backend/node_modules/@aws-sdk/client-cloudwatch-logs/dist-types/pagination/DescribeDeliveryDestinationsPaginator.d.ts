import type { Paginator } from "@smithy/types";
import { DescribeDeliveryDestinationsCommandInput, DescribeDeliveryDestinationsCommandOutput } from "../commands/DescribeDeliveryDestinationsCommand";
import type { CloudWatchLogsPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateDescribeDeliveryDestinations: (config: CloudWatchLogsPaginationConfiguration, input: DescribeDeliveryDestinationsCommandInput, ...rest: any[]) => Paginator<DescribeDeliveryDestinationsCommandOutput>;
