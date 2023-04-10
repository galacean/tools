import { PackingContext } from "../interface/PackingContext";
import { ErrorCode } from "../enum/ErrorCode";

export abstract class OptHandler {
  abstract parse(context: PackingContext): ErrorCode | Promise<ErrorCode>;
}
