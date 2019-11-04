export interface AlbManagerOptions {
  vpcId: string;
  subnetIds: string[];
  tags?: Record<string, string>;
  certificateArn: string;
  domainName: string;
}
