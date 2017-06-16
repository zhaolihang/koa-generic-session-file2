"use strict";

let fs = require("fs");
let path = require("path");

let sinon = require("sinon");
require("sinon-as-promised");
let should = require("should");
require("should-sinon");
let glob = require("glob");

const sidTohex = (sid) => {
  let b = new Buffer(sid);
  return b.toString('hex');
};

const sidstr = 'testsessionid';
const hexsidstr = sidTohex(sidstr);

describe("Generic file store for koa-generic-session", () => {
  describe("Writing sessions", () => {
    let FileStore;

    before(() => {
      sinon.stub(fs, "writeFile").yieldsAsync(null);
      FileStore = require("../index");
    });

    it("should write the session content to a file in the default directory",
      () => {
        let fileStore = new FileStore();
        let session = {};

        return fileStore.set(sidstr, session, 60000).then(() => {
          fs.writeFile.should.be.called();
          fs.writeFile.firstCall.args[0].should
            .match(new RegExp('sessions'));
        });
      });

    it("should write the session content to a file in a custom directory",
      () => {
        let fileStore = new FileStore({
          sessionDirectory: "/tmp/sessions"
        });
        let session = {};
        return fileStore.set(sidstr, session, 60000).then(() => {
          fs.writeFile.should.be.called();
          fs.writeFile.firstCall.args[0].should
            .match(new RegExp("sessions"));
        });
      });

    it("should write a filename that includes the sid and ttl values", () => {
      let fileStore = new FileStore({
        sessionDirectory: "/tmp/sessions"
      });
      let session = {};
      return fileStore.set(sidstr, session, 60000).then(() => {
        fs.writeFile.should.be.called();
        fs.writeFile.firstCall.args[0].should
          .match(new RegExp(hexsidstr + "__60000.json"));
      }).then(() => {
        return fileStore.set("funsessionid", session, 300)
      }).then(() => {
        fs.writeFile.secondCall.args[0].should
          .match(new RegExp(sidTohex('funsessionid') + "__300.json"));
      })
    });

    it("should serialise the session to JSON in the file", () => {
      let fileStore = new FileStore();
      let session = {
        username: "Bob"
      };
      return fileStore.set(sidstr, session, 60000).then(() => {
        let fileContent = fs.writeFile.firstCall.args[1];
        fileContent.should.be.a.String();
        JSON.parse(fileContent).should.deepEqual(session);
      });
    });

    afterEach(() => {
      fs.writeFile.reset();
    });

    after(() => {
      fs.writeFile.restore();
    });
  });

  describe("Reading existing sessions", () => {
    let FileStore;

    before(() => {
      sinon.stub(fs, "readFile")
        .yieldsAsync(null, "{\"username\": \"Bob\"}");
      sinon.stub(fs, "stat");
      sinon.stub(fs, "unlink");
      sinon.stub(glob, "glob").yieldsAsync(null, [
        hexsidstr + "__60000.json"
      ]);
      FileStore = require("../index");
    });

    it("should load a file from the default session directory", () => {
      let fileStore = new FileStore();
      fileStore.get(sidstr).then(() => {
        fs.readFile.should.be.called();
        fs.readFile.firstCall.args[0].should
          .match(new RegExp(path.resolve(__dirname, "../sessions")));
      });
    });

    it("should load a file from a custom session directory", () => {
      let fileStore = new FileStore({
        sessionDirectory: "/tmp/sessions"
      });
      fileStore.get(sidstr).then(() => {
        fs.readFile.should.be.called();
        fs.readFile.firstCall.args[0].should
          .match(new RegExp("sessions"));
      });
    });

    it("should load a file containing the session id", () => {
      let fileStore = new FileStore();
      fileStore.get(sidstr).then(() => {
        fs.readFile.should.be.called();
        fs.readFile.firstCall.args[0].should
          .match(new RegExp(sidstr));
      });
    });

    it("should resolve to a parsed session object", () => {
      let fileStore = new FileStore();
      fileStore.get(sidstr).then((session) => {
        should.exist(session);
        session.should.deepEqual({
          username: "Bob"
        });
      });
    });

    it("should resolve to null if there is no session file", () => {
      glob.glob.yieldsAsync(null, []);
      let fileStore = new FileStore();
      fileStore.get(sidstr).then((session) => {
        should.not.exist(session);
      });
    });

    it("should resolve to null if the session is older than its TTL", () => {
      fs.stat.yieldsAsync(null, {
        mtime: Date.now() - 60100
      });
      let fileStore = new FileStore();
      fileStore.get(sidstr).then((session) => {
        should.not.exist(session);
      });
    });

    it("should delete a matched session file if it is expired", () => {
      fs.stat.yieldsAsync(null, {
        mtime: Date.now() - 60100
      });
      let fileStore = new FileStore();
      fileStore.get(sidstr).then((session) => {
        should.not.exist(session);
        fs.unlink.should.be.calledWith(
          path.resolve(__dirname, "../sessions/" + hexsidstr + "__60000.json"));
      });
    });

    afterEach(() => {
      fs.readFile.reset();
      fs.stat.reset();
      fs.unlink.reset();
      glob.glob.reset();
    });

    after(() => {
      fs.readFile.restore();
      fs.stat.restore();
      fs.unlink.restore();
      glob.glob.restore();
    });
  });

  describe("Destroying sessions", () => {
    let FileStore;

    before(() => {
      sinon.stub(fs, "unlink");
      sinon.stub(glob, "glob").yieldsAsync(null, [
        hexsidstr + "__60000.json"
      ]);
      FileStore = require("../index");
    });

    it("should destroy files with the given session id", () => {
      let fileStore = new FileStore();
      fileStore.destroy(sidstr).then(() => {
        fs.unlink.should.be.called();
        fs.unlink.firstCall.args[0].should.equal(
          path.resolve(__dirname, "../sessions/" + hexsidstr + "__60000.json"));
      });
    });

    afterEach(() => {
      fs.unlink.reset();
      glob.glob.reset();
    });

    after(() => {
      fs.unlink.restore();
      glob.glob.restore();
    });
  });
});
