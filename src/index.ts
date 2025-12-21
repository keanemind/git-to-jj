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

await program.parseAsync();
