export interface FrameworkDetectionItem {
  path: string;
  matchContent?: string;
}

export interface SettingPlaceholder {
  placeholder: string;
}
export interface SettingValue {
  value: string;
}
export type Setting = SettingValue | SettingPlaceholder;

export interface Framework {
  name: string;
  slug: string;
  logo: string;
  demo: string;
  tagline: string;
  website: string;
  description: string;
  detectors?: {
    every?: FrameworkDetectionItem[];
    some?: FrameworkDetectionItem[];
  };
  settings: {
    buildCommand: Setting;
    devCommand: Setting;
    outputDirectory: Setting;
  };
}
