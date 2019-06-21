export type ThenArg<T> = T extends Promise<infer U> ? U : T;

export interface Config {
  alias?: string[] | string;
  aliases?: string[] | string;
  name?: string;
  type?: string;
  scope?: string;
}

export interface NowContext {
  argv: string[];
  apiUrl: string;
  authConfig: {
    token: string;
  };
  config: {
    currentTeam: string;
    updateChannel: string;
  };
  localConfig: Config;
}

type Billing = {
  addons: string[];
  cancelation?: number;
  period: { start: number; end: number };
  plan: string;
  platform: string;
  trial: { start: number; end: number };
};

export type User = {
  uid: string;
  avatar: string;
  bio?: string;
  date: number;
  email: string;
  platformVersion: number;
  username: string;
  website?: string;
  billingChecked: boolean;
  billing: Billing;
  github?: {
    email: string;
    installation: {
      id: string;
      login: string;
      loginType: string;
    };
    login: string;
    updatedAt: number;
  };
};

export type Team = {
  id: string;
  avatar?: string;
  billing: Billing;
  created: string;
  creatorId: string;
  membership: { uid: string; role: 'MEMBER' | 'OWNER'; created: number };
  name: string;
  platformVersion: number;
  slug: string;
};

export type Domain = {
  id: string;
  name: string;
  boughtAt: number;
  createdAt: number;
  expiresAt: number;
  transferStartedAt?: number;
  transferredAt?: number | null;
  orderedAt?: number;
  serviceType: 'zeit.world' | 'external' | 'na';
  verified: boolean;
  nsVerifiedAt: number | null;
  txtVerifiedAt: number | null;
  verificationRecord: string;
  nameservers: string[];
  intendedNameservers: string[];
  creator: {
    id: string;
    username: string;
    email: string;
  };
};

export type Cert = {
  uid: string;
  autoRenew: boolean;
  cns: string[];
  created: string;
  creator: string;
  expiration: string;
};

export type DeploymentScale = {
  [dc: string]: {
    min: number;
    max: number;
  };
};

export type NpmDeployment = {
  uid: string;
  url: string;
  name: string;
  type: 'NPM';
  state: 'INITIALIZING' | 'FROZEN' | 'READY' | 'ERROR';
  version?: number;
  created: number;
  creator: { uid: string };
  sessionAffinity: string;
  scale: DeploymentScale;
};

export type StaticDeployment = {
  uid: string;
  url: string;
  name: string;
  type: 'STATIC';
  state: 'INITIALIZING' | 'FROZEN' | 'READY' | 'ERROR';
  version?: number;
  created: number;
  creator: { uid: string };
  sessionAffinity: string;
};

export type DockerDeployment = {
  uid: string;
  url: string;
  name: string;
  type: 'DOCKER';
  state: 'INITIALIZING' | 'FROZEN' | 'READY' | 'ERROR';
  version?: number;
  created: number;
  creator: { uid: string };
  sessionAffinity: string;
  scale: DeploymentScale;
  limits?: {
    maxConcurrentReqs: number;
    timeout: number;
    duration: number;
  };
  slot?: string;
};

export type Deployment = NpmDeployment | StaticDeployment | DockerDeployment;

type PathAliasRule = {
  pathname: string;
  method: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  dest: string;
};

export type Alias = {
  uid: string;
  alias: string;
  created: string;
  deployment: {
    id: string;
    url: string;
  };
  creator: {
    uid: string;
    username: string;
    email: string;
  };
  deploymentId?: string;
  rules?: PathAliasRule[];
};

export type PathRule = {
  dest: string;
  pathname?: string;
  method?: Array<string>;
};

export type DNSRecord = {
  id: string;
  creator: string;
  mxPriority?: number;
  name: string;
  priority?: number;
  slug: string;
  type: string;
  value: string;
  created: number;
  updated: number;
};

type SRVRecordData = {
  name: string,
  type: 'SRV',
  srv: {
    port: number,
    priority: number,
    target: string,
    weight: number,
  }
}

type MXRecordData = {
  name: string,
  type: 'MX',
  value: string,
  mxPriority: number,
};

export type DNSRecordData = {
  name: string,
  type: string,
  value: string,
} | SRVRecordData | MXRecordData;

export interface Project {
  id: string;
  name: string;
  accountId: string;
  updatedAt: number;
  createdAt: number;
}
