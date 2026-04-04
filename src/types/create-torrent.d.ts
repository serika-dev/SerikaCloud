declare module "create-torrent" {
  import { Readable } from "stream";

  interface FileInput {
    name: string;
    length: number;
    createReadStream(): Readable;
  }

  interface CreateTorrentOptions {
    name?: string;
    comment?: string;
    createdBy?: string;
    creationDate?: Date;
    private?: boolean;
    pieceLength?: number;
    announceList?: string[][];
    urlList?: string[];
  }

  function createTorrent(
    input: FileInput | FileInput[] | string | string[],
    opts: CreateTorrentOptions,
    callback: (err: Error | null, torrent?: Buffer) => void
  ): void;

  export = createTorrent;
}
