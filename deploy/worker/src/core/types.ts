export type AddressType = 'ipv4' | 'domain' | 'ipv6';

export type Destination = {
  host: string;
  port: number;
  addressType: AddressType;
};

export type NeedMore = { kind: 'need-more' };
export type ParseError = { kind: 'error'; code: string };
export type ParseOk<T> = { kind: 'ok'; value: T };
export type ParseResult<T> = NeedMore | ParseError | ParseOk<T>;
