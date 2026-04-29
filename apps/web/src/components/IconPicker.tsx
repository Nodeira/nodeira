import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import {
  ActionIcon,
  Box,
  Group,
  Popover,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { ICON_CATEGORIES } from "../lib/icons.js";
import { DynamicIcon } from "./DynamicIcon.js";

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  children: React.ReactNode; // trigger element
}

export function IconPicker({ value, onChange, children }: IconPickerProps) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.toLowerCase().trim();
  const filtered = query
    ? ICON_CATEGORIES.map((cat) => ({
        ...cat,
        icons: cat.icons.filter((name) => name.includes(query)),
      })).filter((cat) => cat.icons.length > 0)
    : ICON_CATEGORIES;

  function select(name: string) {
    onChange(name);
    setOpened(false);
    setSearch("");
  }

  function clear() {
    onChange(null);
    setOpened(false);
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="right-start"
      offset={8}
      withArrow
      shadow="md"
      width={320}
      trapFocus
    >
      <Popover.Target>
        <div
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpened((o) => !o);
          }}
        >
          {children}
        </div>
      </Popover.Target>

      <Popover.Dropdown style={{ padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* Search bar */}
        <Box p="xs" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <TextInput
            placeholder="Search icons…"
            size="xs"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            autoFocus
          />
          {value && (
            <Group mt={6} gap={6}>
              <DynamicIcon name={value} size={14} color="var(--mantine-primary-color-filled)" />
              <Text size="xs" ff="monospace" c="dimmed" style={{ flex: 1 }}>
                {value}
              </Text>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={clear} title="Clear icon">
                <IconX size={12} />
              </ActionIcon>
            </Group>
          )}
        </Box>

        {/* Icon grid */}
        <ScrollArea h={280} type="scroll">
          <Box p="xs">
            {filtered.map((cat) => (
              <Box key={cat.label} mb="xs">
                <Text
                  size="xs"
                  fw={600}
                  tt="uppercase"
                  c="dimmed"
                  mb={4}
                  style={{ letterSpacing: "0.07em", fontSize: 10 }}
                >
                  {cat.label}
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
                  {cat.icons.map((name) => (
                    <Tooltip key={name} label={name} position="top" openDelay={600} withArrow>
                      <UnstyledButton
                        onClick={() => select(name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 4,
                          background:
                            value === name ? "var(--mantine-primary-color-light)" : "transparent",
                          color:
                            value === name
                              ? "var(--mantine-primary-color-filled)"
                              : "var(--mantine-color-text)",
                        }}
                        onMouseEnter={(e) => {
                          if (value !== name)
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "var(--mantine-color-default-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (value !== name)
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <DynamicIcon name={name} size={16} />
                      </UnstyledButton>
                    </Tooltip>
                  ))}
                </div>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Text size="xs" c="dimmed" fs="italic" ta="center" py="md">
                No icons found for &ldquo;{search}&rdquo;
              </Text>
            )}
          </Box>
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  );
}
