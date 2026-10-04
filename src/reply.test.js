import assert from "node:assert/strict";
import test from "node:test";
import { isSoft, makeReply } from "./reply.js";

test("blank lines do not get a reply", () => {
  assert.equal(makeReply("   "), null);
  assert.equal(makeReply(""), null);
});

test("food replies use the food word and another word they said", () => {
  const reply = makeReply("I like pizza and rain");
  assert.match(reply.toLowerCase(), /pizza/);
  assert.match(reply.toLowerCase(), /rain/);
});

test("clothes replies use the clothing word and another word they said", () => {
  const reply = makeReply("nice hat please");
  assert.match(reply.toLowerCase(), /hat/);
  assert.match(reply.toLowerCase(), /nice/);
});

test("a line about both food and clothes uses both", () => {
  const reply = makeReply("cookie scarf");
  assert.match(reply.toLowerCase(), /cookie/);
  assert.match(reply.toLowerCase(), /scarf/);
});

test("questions echo a word the player used", () => {
  const reply = makeReply("do you like stars?");
  assert.match(reply.toLowerCase(), /stars/);
});

test("the same line always gets the same reply", () => {
  assert.equal(makeReply("hello mallow"), makeReply("hello mallow"));
});

test("a plain word is echoed back", () => {
  const reply = makeReply("buttons");
  assert.match(reply.toLowerCase(), /buttons/);
});

test("ice cream is heard as a snack phrase", () => {
  const reply = makeReply("may I have ice cream");
  assert.match(reply.toLowerCase(), /ice cream/);
});

test("unkind words are not repeated", () => {
  const reply = makeReply("you are stupid");
  assert.doesNotMatch(reply.toLowerCase(), /stupid/);
  assert.match(reply.toLowerCase(), /soft/);
  assert.equal(isSoft("stupid"), false);
  assert.equal(isSoft("Mallow"), true);
});
