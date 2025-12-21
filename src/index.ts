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

await program.parseAsync();
