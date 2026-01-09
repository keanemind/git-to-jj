#!/usr/bin/env node

import { Command } from "commander";
import { $ } from "zx";

$.verbose = true;

const program = new Command();

program
  .name("git-to-jj")
  .description("Git porcelain commands implemented as Jujutsu operations")
  .version("1.0.0");

program
  .command("init")
  .description("Create an empty repository")
  .argument("[directory]", "Directory to create the repository in.")
  .action(async (directory: string | undefined) => {
    await $`jj git init --no-colocate ${directory ?? ""}`;

    // Create main branch
    await $`jj bookmark create main`;

    // Set up index and working tree
    await $`jj describe --message "index"`;
    await $`jj new --message "working tree"`;
  });

program
  .command("add")
  .description("Add file contents to the index")
  .argument("[<pathspec>...]", "Files to add content from.")
  .action(async (files: string[]) => {
    // Move the specified files from the working tree to the index
    await $`jj squash --keep-emptied ${files.join(" ")}`;
  });

program
  .command("commit")
  .description("Record changes to the repository")
  .option("-m, --message <msg>", "Use the given <msg> as the commit message.")
  .action(async (options: { message?: string }) => {
    // Check if the index is empty
    const diff = await $`jj diff --revisions @-`;
    if (diff.stdout.trim() === "") {
      console.log("There are no staged changes to commit");
      return;
    }

    // Convert the index into the new commit
    await $`jj describe @- --message ${options.message ?? ""}`;

    // Create a new empty index
    await $`jj new --insert-before @ --message "index" --no-edit`;
  });

program
  .command("branch")
  .description("List, create, or delete branches")
  .argument("[<branchname>]", "The name of the branch to create.")
  .option("-d, --delete <branchname>", "Delete the branch <branch>.")
  .action(
    async (branchname: string | undefined, options: { delete?: string }) => {
      if (branchname) {
        await $`jj bookmark create ${branchname}`;
      } else if (options.delete) {
        await $`jj bookmark delete ${options.delete}`;
      } else {
        await $`jj bookmark list`;
      }
    },
  );

program
  .command("switch")
  .description("Switch branches")
  .argument("<branch>", "The branch to switch to.")
  .action(async (branch: string) => {
    // Keep track of the current operation in case we need to revert
    const startingOperationId = (
      await $`jj operation show --template "self.id()" --no-op-diff`
    ).stdout.trim();

    // Move both the index and working tree to the new branch
    await $`jj rebase --source @- --destination ${branch}`;

    // Check if there are any conflicts in the index or working tree.
    // Note that if there is a conflict in the index, there will also
    // be a conflict in the working tree, because the working tree is
    // a descendant of the index.
    const isConflicted =
      (
        await $`jj log --revisions @ --template "self.conflict()" --no-graph`
      ).stdout.trim() === "true";

    if (isConflicted) {
      // Revert our rebase
      await $`jj operation restore ${startingOperationId}`;

      // TODO: implement "Your local changes to the following files would be overwritten..."

      throw new Error(
        "Please commit your changes or stash them before you switch branches.",
      );
    }
  });

await program.parseAsync();
