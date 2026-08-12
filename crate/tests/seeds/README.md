Seeds for `tests/fuzz.rs`, and only for it.

The shared corpus in `../../fixtures/documents/` is the parity contract
and is deliberately all ASCII, which is exactly why it could not catch a
blanker replacing a multi-byte character with one space and sliding every
byte offset after it until a slice landed mid-character. These files are
the other half: the same shapes, written with characters wider than one
byte, including one whose lowercase is a different length again.

They pin nothing. They are starting points the fuzzer mutates.
