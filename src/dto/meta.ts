export interface MetaDto {
  objects_count: number;
  lines: [
    {
      name: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  ];
  zones: [
    {
      name: string;
      points: [
        {
          x: number;
          y: number;
        }
      ];
    }
  ];
  objects: [
    {
      title: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  ];
}
